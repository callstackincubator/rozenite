/**
 * End-to-end proof that `patchRozeniteIntegrationDomain` actually works
 * against a real `@react-native/dev-middleware` inspector proxy — not just
 * against the fake connection objects `integration-domain.test.ts` uses.
 * `@react-native/dev-middleware` is already a devDependency of this package
 * for exactly this reason.
 *
 * This exercises the same ordering constraint documented in
 * `integration-domain.ts`: it patches first, then requires/destructures
 * `createDevMiddleware` off the package the way a real embedder would,
 * because a destructure captures the getter's value at that instant.
 */
import { createServer, get, type Server } from 'node:http';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { patchRozeniteIntegrationDomain } from '../integration-domain.js';
import { getDevMiddlewarePath, type ProjectResolutionOptions } from '../resolve.js';

const require = createRequire(import.meta.url);

// Mirrors the "standalone app" suite in `@rozenite/middleware`'s
// `middleware.test.ts`: resolving react-native and
// @react-native/dev-middleware needs a real install, so point at this
// package's own directory, where both are hoisted.
const projectRoot = new URL('../..', import.meta.url).pathname;

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Node's global `fetch` isn't declared by this project's `@types/node`
// version, and no other test in this suite relies on it - `http.get` (as
// `middleware.test.ts`'s `runRequest` already does) keeps this consistent.
const getJson = (url: string): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => (body += chunk));
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
};

type JSONRecord = Record<string, unknown>;

const nextMessage = (
  socket: WebSocket,
  predicate: (message: JSONRecord) => boolean,
  timeoutMs = 3000,
): Promise<JSONRecord> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('message', onMessage);
      reject(new Error(`Timed out waiting for a matching message after ${timeoutMs}ms`));
    }, timeoutMs);

    const onMessage = (raw: Buffer | ArrayBuffer | Buffer[]) => {
      const message = JSON.parse(raw.toString()) as JSONRecord;
      if (predicate(message)) {
        clearTimeout(timer);
        socket.off('message', onMessage);
        resolve(message);
      }
    };

    socket.on('message', onMessage);
  });
};

describe('patchRozeniteIntegrationDomain (real dev-middleware)', () => {
  let server: Server | null = null;
  let device: WebSocket | null = null;
  let dbg: WebSocket | null = null;

  afterEach(async () => {
    device?.close();
    dbg?.close();
    device = null;
    dbg = null;

    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
  });

  it(
    'answers Rozenite.getEnvironment from the proxy and never forwards it to the device, ' +
      'while composing with an embedder-supplied handler',
    async () => {
      const options: ProjectResolutionOptions = { projectRoot };

      // Patch BEFORE requiring/destructuring - see the module doc comment
      // on why the order is load-bearing.
      patchRozeniteIntegrationDomain(options, 'react-native');

      const embedderFactoryCalls: string[] = [];
      const embedderHandled = { deviceMessage: '', debuggerMessage: '' };
      // Simulates an embedder (e.g. Expo) that already occupies the slot,
      // the way `dev-tools-url-patch.ts`'s counterpart proof did.
      const embedderFactory = (connection: { page: { id: string } }) => {
        embedderFactoryCalls.push(connection.page.id);
        return {
          handleDeviceMessage: (message: JSONRecord) => {
            embedderHandled.deviceMessage = String(message.method ?? '');
            return undefined;
          },
          handleDebuggerMessage: (message: JSONRecord) => {
            embedderHandled.debuggerMessage = String(message.method ?? '');
            return undefined;
          },
        };
      };

      // Resolved the same way `patchRozeniteIntegrationDomain` resolved the
      // module it patched (`getDevMiddlewarePath`, not a bare
      // `require('@react-native/dev-middleware')`): this monorepo hoists a
      // second, independent copy of the package under
      // `@react-native/community-cli-plugin`'s own `node_modules`, and a
      // bare require from this test file resolves that other copy instead
      // - unpatched. A real embedder never hits this, because it always
      // resolves the package from that same community-cli-plugin (or Expo)
      // dependency chain that `getDevMiddlewarePath` mirrors.
      const { createDevMiddleware } = require(getDevMiddlewarePath(options));
      const { middleware, websocketEndpoints } = createDevMiddleware({
        projectRoot,
        serverBaseUrl: 'http://localhost:0',
        unstable_customInspectorMessageHandler: embedderFactory,
        // The resolved copy's default experiments include
        // enableStandaloneFuseboxShell, which eagerly calls
        // toolLauncher.prepareDebuggerShell() as a side effect of this very
        // call - and that launcher asserts it is mocked whenever
        // NODE_ENV === 'test' (which Vitest sets), throwing an unhandled
        // rejection unrelated to anything under test here. Disabled along
        // with enableOpenDebuggerRedirect, which this test also never uses.
        unstable_experiments: {
          enableOpenDebuggerRedirect: false,
          enableStandaloneFuseboxShell: false,
        },
      });

      server = createServer(middleware);
      const endpointsByPath = new Map<string, WebSocketServer>(
        Object.entries(websocketEndpoints as Record<string, WebSocketServer>),
      );
      server.on('upgrade', (req, socket, head) => {
        const { pathname } = new URL(req.url ?? '/', 'http://localhost');
        const endpoint = endpointsByPath.get(pathname);
        if (!endpoint) {
          socket.destroy();
          return;
        }
        endpoint.handleUpgrade(req, socket, head, (client) => {
          endpoint.emit('connection', client, req);
        });
      });

      await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Expected an ephemeral TCP port');
      }
      const port = address.port;

      // --- fake device ---
      const page = {
        id: 'page-1',
        title: 'Fake target',
        description: 'com.example.app',
        app: 'com.example.app',
        capabilities: { nativePageReloads: true, nativeSourceCodeFetching: true },
      };
      const deviceReceived: JSONRecord[] = [];

      device = new WebSocket(
        `ws://127.0.0.1:${port}/inspector/device?device=device-1&name=Test&app=com.example.app`,
      );
      device.on('message', (raw) => {
        const message = JSON.parse(raw.toString()) as JSONRecord;
        if (message.event === 'getPages') {
          device!.send(JSON.stringify({ event: 'getPages', payload: [page] }));
          return;
        }
        if (message.event === 'wrappedEvent') {
          const payload = message.payload as { wrappedEvent: string };
          deviceReceived.push(JSON.parse(payload.wrappedEvent));
        }
      });

      await new Promise<void>((resolve) => device!.on('open', () => resolve()));
      // The proxy's getPages poll runs every 1000ms; /json/list only
      // populates after it has run at least once.
      await wait(1200);

      const list = (await getJson(`http://127.0.0.1:${port}/json/list`)) as Array<{ id: string }>;
      // The proxy's /json/list id is "{deviceId}-{pageId}", not the bare page id.
      expect(list.some((target) => target.id === 'device-1-page-1')).toBe(true);

      // --- fake debugger ---
      // The debugger endpoint 401s without an allowed Origin.
      dbg = new WebSocket(`ws://127.0.0.1:${port}/inspector/debug?device=device-1&page=page-1`, {
        origin: 'http://localhost',
      });
      const debuggerReceived: JSONRecord[] = [];
      dbg.on('message', (raw) => debuggerReceived.push(JSON.parse(raw.toString())));

      await new Promise<void>((resolve) => dbg!.on('open', () => resolve()));

      // 1. Ask a domain no device implements.
      dbg.send(JSON.stringify({ id: 1, method: 'Rozenite.getEnvironment' }));
      const reply = await nextMessage(dbg, (message) => message.id === 1);

      expect(reply).toEqual({ id: 1, result: { integration: 'react-native' } });

      // 2. The device volunteers its own metadata - proxy only snoops it,
      // and it must still reach the debugger unmodified.
      device.send(
        JSON.stringify({
          event: 'wrappedEvent',
          payload: {
            pageId: 'page-1',
            wrappedEvent: JSON.stringify({
              method: 'ReactNativeApplication.metadataUpdated',
              params: { integrationName: 'Rozenite', platform: 'web', appDisplayName: 'MyApp' },
            }),
          },
        }),
      );
      await nextMessage(
        dbg,
        (message) => message.method === 'ReactNativeApplication.metadataUpdated',
      );

      // 3. Never forwarded to the device.
      expect(deviceReceived.some((message) => message.method === 'Rozenite.getEnvironment')).toBe(
        false,
      );

      // 4. Composition: the embedder's own factory and handlers still ran.
      expect(embedderFactoryCalls).toContain('page-1');
      expect(embedderHandled.deviceMessage).toBe('ReactNativeApplication.metadataUpdated');
    },
    10000,
  );
});
