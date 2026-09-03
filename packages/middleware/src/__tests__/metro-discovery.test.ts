import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { getMetroTargets, resolveMetroTarget } from '../agent/metro-discovery.js';

let server: Server | null = null;

/**
 * Serves `body` (JSON-encoded) for `GET /json/list`, standing in for
 * Metro's inspector proxy or `@rozenite/lynx-dev`'s own implementation --
 * the middleware talks to both the same way, over `node:http`.
 */
const startJsonListServer = async (
  body: unknown,
  { status = 200 }: { status?: number } = {},
): Promise<{ port: number }> => {
  const instance = createServer((req, res) => {
    if ((req.url ?? '').split('?', 1)[0] !== '/json/list') {
      res.writeHead(404).end();
      return;
    }

    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });

  server = instance;

  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));

  const address = instance.address();
  if (!address || typeof address !== 'object') {
    throw new Error('Expected a TCP address');
  }

  return { port: address.port };
};

afterEach(async () => {
  const instance = server;
  server = null;
  if (instance) {
    await new Promise<void>((resolve) => instance.close(() => resolve()));
  }
});

describe('getMetroTargets', () => {
  it('groups pages by logicalDeviceId, skipping pages without one', async () => {
    const { port } = await startJsonListServer([
      {
        id: 'device-1-1',
        title: 'Page 1',
        description: '',
        appId: 'com.example.app',
        deviceName: 'iPhone 15',
        webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=1',
        reactNative: { logicalDeviceId: 'device-1' },
      },
      {
        id: 'page-no-device',
        title: 'No device',
        description: '',
        appId: 'com.example.orphan',
        deviceName: 'Orphan',
        webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=orphan&page=1',
      },
    ]);

    const targets = await getMetroTargets('127.0.0.1', port, 'react-native');

    expect(targets).toEqual([
      {
        id: 'device-1-1',
        deviceId: 'device-1',
        name: 'iPhone 15',
        appId: 'com.example.app',
        pageId: '1',
        title: 'Page 1',
        description: '',
        webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=1',
        integration: 'react-native',
      },
    ]);
  });

  it('keeps every page of a device that hosts several runtimes', async () => {
    // Two Lynx cards in one app, both Fusebox-capable. Neither is a
    // duplicate of the other, so collapsing them to one would leave the
    // second unreachable -- which is exactly what happened in
    // LynxExplorer, where page 1 is its own home screen.
    const { port } = await startJsonListServer([
      {
        id: 'device-1-2',
        title: 'http://localhost:3000/main.lynx.bundle',
        description: '',
        appId: 'LynxExplorer',
        deviceName: 'iPhone',
        webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=2',
        reactNative: {
          logicalDeviceId: 'device-1',
          capabilities: { prefersFuseboxFrontend: true },
        },
      },
      {
        id: 'device-1-1',
        title: '/Applications/LynxExplorer.app/Resource/homepage.lynx.bundle',
        description: '',
        appId: 'LynxExplorer',
        deviceName: 'iPhone',
        webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=1',
        reactNative: {
          logicalDeviceId: 'device-1',
          capabilities: { prefersFuseboxFrontend: true },
        },
      },
    ]);

    const targets = await getMetroTargets('127.0.0.1', port, 'lynx');

    expect(targets.map((target) => target.id)).toEqual(['device-1-1', 'device-1-2']);
    // One device, so they must agree on it -- that is what still lets
    // `--deviceId` name the pair.
    expect(new Set(targets.map((target) => target.deviceId))).toEqual(new Set(['device-1']));
    expect(targets.every((target) => target.integration === 'lynx')).toBe(true);
  });

  it('prefers the page with prefersFuseboxFrontend, tie-broken by id', async () => {
    const { port } = await startJsonListServer([
      {
        id: 'page-b',
        title: 'Legacy',
        description: '',
        appId: 'com.example.app',
        deviceName: 'Pixel 8',
        webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=b',
        reactNative: { logicalDeviceId: 'device-1' },
      },
      {
        id: 'page-a',
        title: 'Fusebox',
        description: '',
        appId: 'com.example.app',
        deviceName: 'Pixel 8',
        webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=a',
        reactNative: {
          logicalDeviceId: 'device-1',
          capabilities: { prefersFuseboxFrontend: true },
        },
      },
    ]);

    const targets = await getMetroTargets('127.0.0.1', port, 'react-native');

    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe('page-a');
  });

  it('extracts pageId from the page query parameter of webSocketDebuggerUrl, not the composite id', async () => {
    const { port } = await startJsonListServer([
      {
        id: 'device-1-2',
        title: 'Card',
        description: '',
        appId: 'LynxExplorer',
        deviceName: 'iPhone',
        webSocketDebuggerUrl: 'ws://localhost:3000/inspector/debug?device=device-1&page=2',
        reactNative: {
          logicalDeviceId: 'device-1',
          capabilities: { prefersFuseboxFrontend: true },
        },
      },
    ]);

    const targets = await getMetroTargets('127.0.0.1', port, 'lynx');

    expect(targets[0].id).toBe('device-1-2');
    expect(targets[0].pageId).toBe('2');
  });

  it('falls back to the composite id when webSocketDebuggerUrl has no page parameter', async () => {
    const { port } = await startJsonListServer([
      {
        id: 'device-1-1',
        title: 'No page param',
        description: '',
        appId: 'com.example.app',
        deviceName: 'iPhone',
        webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1',
        reactNative: { logicalDeviceId: 'device-1' },
      },
    ]);

    const targets = await getMetroTargets('127.0.0.1', port, 'react-native');

    expect(targets[0].pageId).toBe('device-1-1');
  });

  it('sorts devices by name then id', async () => {
    const { port } = await startJsonListServer([
      {
        id: 'page-z',
        title: 'Z',
        description: '',
        appId: 'com.example.z',
        deviceName: 'Zebra',
        webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=z&page=1',
        reactNative: { logicalDeviceId: 'z' },
      },
      {
        id: 'page-a',
        title: 'A',
        description: '',
        appId: 'com.example.a',
        deviceName: 'Apple',
        webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=a&page=1',
        reactNative: { logicalDeviceId: 'a' },
      },
    ]);

    const targets = await getMetroTargets('127.0.0.1', port, 'react-native');

    expect(targets.map((target) => target.name)).toEqual(['Apple', 'Zebra']);
  });

  it('stamps integration on every target, for both react-native and lynx', async () => {
    const body = [
      {
        id: 'device-1-1',
        title: 'Page 1',
        description: '',
        appId: 'com.example.app',
        deviceName: 'iPhone',
        webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=1',
        reactNative: { logicalDeviceId: 'device-1' },
      },
    ];

    const rn = await startJsonListServer(body);
    const rnTargets = await getMetroTargets('127.0.0.1', rn.port, 'react-native');
    expect(rnTargets[0].integration).toBe('react-native');

    await new Promise<void>((resolve) => server?.close(() => resolve()));

    const lynx = await startJsonListServer(body);
    const lynxTargets = await getMetroTargets('127.0.0.1', lynx.port, 'lynx');
    expect(lynxTargets[0].integration).toBe('lynx');
  });

  it('fails with a message naming the URL tried when the dev server cannot be reached', async () => {
    // Nothing is listening on this port.
    await expect(getMetroTargets('127.0.0.1', 1, 'react-native')).rejects.toThrow(
      'Unable to reach Metro at http://127.0.0.1:1',
    );
  });

  it('fails with a helpful message when the dev server responds with an error status', async () => {
    const { port } = await startJsonListServer([], { status: 500 });

    await expect(getMetroTargets('127.0.0.1', port, 'react-native')).rejects.toThrow(
      /Unable to reach Metro at http:\/\/127\.0\.0\.1:\d+.*status 500/,
    );
  });
});

describe('resolveMetroTarget', () => {
  it('reports no connected device when the dev server has none', async () => {
    const { port } = await startJsonListServer([]);

    await expect(resolveMetroTarget('127.0.0.1', port, 'react-native')).rejects.toThrow(
      'No connected device is available.',
    );
  });

  it('returns the sole target when exactly one device is connected', async () => {
    const { port } = await startJsonListServer([
      {
        id: 'device-1-1',
        title: 'Page 1',
        description: '',
        appId: 'com.example.app',
        deviceName: 'iPhone',
        webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=1',
        reactNative: { logicalDeviceId: 'device-1' },
      },
    ]);

    const target = await resolveMetroTarget('127.0.0.1', port, 'react-native');
    expect(target.id).toBe('device-1-1');
  });

  it('asks for --deviceId when more than one device is connected', async () => {
    const { port } = await startJsonListServer([
      {
        id: 'device-1-1',
        title: 'Page 1',
        description: '',
        appId: 'com.example.app',
        deviceName: 'iPhone',
        webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=1',
        reactNative: { logicalDeviceId: 'device-1' },
      },
      {
        id: 'device-2-1',
        title: 'Page 1',
        description: '',
        appId: 'com.example.app',
        deviceName: 'Pixel',
        webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-2&page=1',
        reactNative: { logicalDeviceId: 'device-2' },
      },
    ]);

    await expect(resolveMetroTarget('127.0.0.1', port, 'react-native')).rejects.toThrow(
      'Multiple connected devices detected.',
    );
  });
});
