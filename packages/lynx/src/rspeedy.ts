/**
 * The public entry point (`@rozenite/lynx/rspeedy`): an rspeedy/Rsbuild
 * plugin that wires `./rspeedy/transport/` (DebugRouter discovery) and
 * `./rspeedy/server/` (the transport-agnostic `/json/list` +
 * `/inspector/debug` HTTP/WS half) into a Lynx dev server — the same shape
 * `@rozenite/metro`'s `withRozenite` gives Metro, and `@rozenite/repack`'s
 * `withRozenite` gives Re.Pack. It also injects `@rozenite/lynx/runtime`
 * (the device runtime) into the app's bundle — see `RUNTIME_ENTRY` below.
 *
 * `@lynx-js/rspeedy` re-exports `RsbuildPlugin` from `@rsbuild/core`
 * unchanged, so this is written directly against `@rsbuild/core`'s types
 * (a devDependency here) rather than depending on `@lynx-js/rspeedy`
 * itself.
 */
import type { IncomingMessage } from 'node:http';
import { createRequire } from 'node:module';
import type { RsbuildPlugin } from '@rsbuild/core';
import {
  createScopedMiddleware,
  initializeRozenite,
  RozeniteResolverPlugin,
  type RozeniteConfig,
} from '@rozenite/middleware';
import { logger } from '@rozenite/tools';
import { createLynxTransport } from './rspeedy/transport/index.js';
import { createRozeniteLynxServer, listInspectorTargets } from './rspeedy/server/index.js';

/**
 * The device runtime's own entry point (`@rozenite/lynx/runtime` — see
 * `packages/lynx/src/runtime.ts`), injected into the app's bundle below via
 * `source.preEntry` instead of asking the user to import it by hand.
 *
 * This is a package *self-reference*: this module lives inside
 * `@rozenite/lynx`, and Node resolves the specifier through this package's
 * own `exports` map by matching the `name` in the nearest `package.json`.
 * It therefore needs no `node_modules` lookup and behaves identically
 * whether the package is symlinked (pnpm workspace) or installed normally.
 *
 * The `/runtime` subpath, not the package root: the root export is
 * `<Rozenite />`, the app-side seam (`packages/lynx/src/index.tsx`), which
 * must be side-effect-free so it can be rendered unconditionally in
 * production. Only `/runtime` may install the dispatcher on import.
 *
 * `createRequire(import.meta.url)` rather than a bare `require.resolve`:
 * `require` does not exist in an ESM module, and this package ships both
 * ESM and CJS. Rollup shims `import.meta.url` in the `.cjs` output, so
 * this one form works from either. The same pattern is used in
 * `packages/repack/src/version-check.ts` and
 * `./rspeedy/transport/connector.ts`.
 *
 * Note this resolves the `require` condition, so it yields
 * `dist/runtime.cjs` rather than `dist/runtime.js`. That is fine — the
 * value is only ever handed to Rspack as an entry path, and it bundles
 * either form. What matters is that it is the same physical package the
 * app would have imported itself.
 */
const require = createRequire(import.meta.url);
const RUNTIME_ENTRY = require.resolve('@rozenite/lynx/runtime');

export type { LynxClient, LynxSession, DeviceFrame, LynxTransport } from './rspeedy/types.js';
export {
  createLynxTransport,
  type LynxTransportLogger,
  type LynxTransportOptions,
} from './rspeedy/transport/index.js';
export {
  createRozeniteLynxServer,
  listInspectorTargets,
  computeLogicalDeviceId,
  findClientByLogicalDeviceId,
  type InspectorTarget,
  type Logger,
  type RozeniteLynxServer,
  type RozeniteLynxServerOptions,
} from './rspeedy/server/index.js';

export type RozeniteLynxOptions = Omit<RozeniteConfig, 'projectRoot' | 'integration'> & {
  /**
   * Whether to enable Rozenite.
   *
   * @default `process.env.NODE_ENV !== 'production'`
   */
  enabled?: boolean;
  /** Restrict device discovery to one physical device serial/udid. */
  deviceSerial?: string;
  /** Platform toggles for DebugRouter discovery. Default: Android + iOS on. */
  enableAndroid?: boolean;
  enableIOS?: boolean;
  enableHarmony?: boolean;
  enableDesktop?: boolean;
  /**
   * Rozenite plugin packages that are allowed to reach a production bundle.
   *
   * By default, the resolver guard installed by this plugin (see
   * `RozeniteResolverPlugin` in `@rozenite/middleware`) throws when a
   * production build resolves into a Rozenite plugin package through
   * anything other than that plugin's declared `productionEntries`. This is
   * an escape hatch, not a fix: listing a package here defeats that
   * guarantee for it. Prefer declaring `productionEntries` in the plugin's
   * `rozenite.config.ts` instead. Every package listed here is logged
   * loudly once per build.
   */
  allowInProduction?: string[];
};

const PLUGIN_NAME = 'rozenite-lynx';

/**
 * Builds the URL a developer opens to get Rozenite's DevTools for one
 * inspector target — the standalone `@rozenite/app`, told which device and
 * page to connect to via the same `?ws=&appId=` convention Fusebox's own
 * frontend uses (see `packages/app/src/connection/target-from-url.ts`).
 */
const buildDevToolsUrl = (
  host: string,
  port: number,
  target: { logicalDeviceId: string; sessionId: number; appId: string },
): string => {
  const wsPath = `/inspector/debug?device=${target.logicalDeviceId}&page=${target.sessionId}`;
  const query = new URLSearchParams({ ws: wsPath, appId: target.appId });
  return `http://${host}:${port}/rozenite/app?${query.toString()}`;
};

/**
 * Rsbuild's default `server.host` is `0.0.0.0` (and it may be `::`), which
 * is a valid bind address but not something a browser can usefully open.
 * The printed URL has to be clickable, so a wildcard bind is reported as
 * `localhost`; an explicitly configured host is left alone.
 */
const WILDCARD_HOSTS = new Set(['0.0.0.0', '::', '[::]', '']);

const toBrowsableHost = (host: string): string => (WILDCARD_HOSTS.has(host) ? 'localhost' : host);

export const rozeniteLynxPlugin = (options: RozeniteLynxOptions = {}): RsbuildPlugin => {
  return {
    name: PLUGIN_NAME,
    // No `apply: 'serve'` here (unlike earlier versions of this plugin):
    // the resolver guard below must run during `rspeedy build` too, or a
    // production build is never observed at all (issue #492 / ADR 0002).
    // `setup` therefore runs for every action; production safety comes
    // from the two checks inside it, not from Rsbuild skipping the plugin.
    setup: async (api) => {
      const allowInProduction = options.allowInProduction ?? [];

      if (allowInProduction.length > 0) {
        logger.warn(
          `allowInProduction is set for: ${allowInProduction.join(', ')}. ` +
            'Code from these Rozenite plugin package(s) may reach your production bundle -- ' +
            'this defeats the production guarantee for them. Prefer declaring productionEntries ' +
            "in the plugin's rozenite.config.ts instead.",
        );
      }

      // Mirrors `@rozenite/metro`'s direction of travel (see
      // `packages/metro/src/index.ts`): Rozenite must never turn itself on
      // by default in a production build. `action === 'build'` covers
      // `rspeedy build` even when a caller flips `enabled` on
      // unconditionally for every action; the `enabled` half covers a
      // `dev` server that a caller explicitly wants disabled outside local
      // development (e.g. a shared/staging Lynx dev server). Read once so
      // the whole plugin body sees one consistent answer regardless of
      // when `api.context.action` happens to settle.
      const enabled =
        (options.enabled ?? process.env.NODE_ENV !== 'production') &&
        api.context.action !== 'build';

      // The guard is installed unconditionally -- in `build` as much as in
      // `dev` -- because a production bundle must be checked even when
      // nothing above wired a dev server into it. `enabled: false` (or a
      // plain `rspeedy build`) means "no dev server, guard still active",
      // exactly like `@rozenite/repack`'s `withRozenite`. `isDev` comes
      // from Rsbuild's own resolved mode for this compilation, not
      // `process.env.NODE_ENV`, since `rspeedy build` does not reliably
      // set it before this config is resolved.
      api.modifyRspackConfig((config, { isDev }) => {
        config.plugins.push(
          new RozeniteResolverPlugin({
            projectRoot: api.context.rootPath,
            allowInProduction,
            isDev,
            installDevEntryRedirect: enabled,
            targetIntegration: 'lynx',
            setupFunctionName: 'rozeniteLynxPlugin()',
          }),
        );
      });

      if (!enabled) {
        return;
      }

      const rozenite = await initializeRozenite(
        {
          projectRoot: api.context.rootPath,
          integration: 'lynx',
          include: options.include,
          exclude: options.exclude,
          destroyOnDetachPlugins: options.destroyOnDetachPlugins,
          projectType: options.projectType,
          logLevel: options.logLevel,
          pluginDisplay: options.pluginDisplay,
        },
        // `@rozenite/runtime` is a React Native runtime shim
        // (`packages/runtime`) and is not — and should not become — a
        // dependency of this package: Lynx apps import `@rozenite/lynx`
        // instead (see this package's README). `runtimeVersion` is only
        // used to report a version alongside React Native plugin
        // manifests, which does not apply here.
        undefined,
      );

      const transport = await createLynxTransport({
        deviceSerial: options.deviceSerial,
        enableAndroid: options.enableAndroid,
        enableIOS: options.enableIOS,
        enableHarmony: options.enableHarmony,
        enableDesktop: options.enableDesktop,
        logger,
      });

      const server = createRozeniteLynxServer({ transport, logger });

      api.modifyRsbuildConfig((config) => {
        config.dev ??= {};
        const previous = config.dev.setupMiddlewares
          ? Array.isArray(config.dev.setupMiddlewares)
            ? config.dev.setupMiddlewares
            : [config.dev.setupMiddlewares]
          : [];

        config.dev.setupMiddlewares = [
          ...previous,
          (middlewares) => {
            middlewares.push(server.middleware);
            middlewares.push(createScopedMiddleware('/rozenite', rozenite.middleware));
          },
        ];

        // Inject the device runtime instead of asking the user to import it
        // by hand (issue #488). `source.preEntry` modules are added before
        // the app's own entry, which is exactly the ordering the runtime
        // needs: it must install `__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__`
        // before any plugin's `useRozeniteDevToolsClient` can run.
        //
        // This whole `modifyRsbuildConfig` callback sits behind the
        // `enabled` check above, which is `false` for a plain `rspeedy
        // build` regardless of what a caller passes — see that check's
        // comment. There is no code path from here to a production
        // bundle — the previous approach asked every app to get a
        // `__DEV__` guard right by hand at its own entry point; this one
        // removes the app's entry point from the equation entirely.
        config.source ??= {};
        const prevPreEntry = config.source.preEntry ?? [];
        config.source.preEntry = [
          ...(Array.isArray(prevPreEntry) ? prevPreEntry : [prevPreEntry]),
          RUNTIME_ENTRY,
        ];
      });

      // --- WebSocket upgrade wiring -------------------------------------
      //
      // `SetupMiddlewaresContext` (the second argument the function above
      // receives) only exposes `sockWrite` and `environments` — no way to
      // reach the underlying `http.Server` from there. The documented,
      // supported way turns out to be the `onBeforeStartDevServer` hook:
      // its payload's `server` (an `RsbuildDevServer`) already carries
      // `httpServer` by the time this hook fires — `createDevServer` in
      // `@rsbuild/core` assigns it before calling this hook, well before
      // `devServer.listen()` (and therefore before Rsbuild attaches its
      // own HMR `'upgrade'` listener). Confirmed by reading
      // `@rsbuild/core`'s compiled source in `node_modules`, not just its
      // `.d.ts` files. This replaces an earlier plan to capture the
      // server off the socket of the first request that reaches the
      // middleware above (`(req.socket as { server }).server`) — keep
      // that trick in mind only if a future Rsbuild version stops handing
      // out `httpServer` here.
      const attachedHttpServers = new WeakSet<object>();

      api.onBeforeStartDevServer(({ server: devServer }) => {
        const httpServer = devServer.httpServer;
        if (!httpServer) {
          // `server.middlewareMode` is enabled: there is no `http.Server`
          // for this plugin to attach to, so Lynx devices will not be
          // able to reach `/inspector/debug`. Everything else (plugin
          // discovery, `/json/list`) still works.
          logger.warn(
            '[Rozenite Lynx] No http.Server available to attach the inspector ' +
              'WebSocket route to (is server.middlewareMode enabled?). ' +
              'Lynx devices will not be able to connect.',
          );
          return;
        }
        if (attachedHttpServers.has(httpServer)) {
          return;
        }
        attachedHttpServers.add(httpServer);

        httpServer.on('upgrade', (request: IncomingMessage, socket, head: Buffer) => {
          // Never destroy a socket this route doesn't claim: Rsbuild's
          // own HMR WebSocket listens on this same `'upgrade'` event, and
          // `handleUpgrade` already returns `false` (leaving the socket
          // untouched) for any path it doesn't recognise.
          server.handleUpgrade(request, socket, head);
        });
      });

      // --- "DevTools URL available" logging ------------------------------
      //
      // Logged once per inspector target (a device, or one of its cards)
      // the first time it appears, using the actual host/port the dev
      // server ended up bound to — not requested config, since Rsbuild
      // may have incremented the port if the requested one was taken.
      let devServerAddress: { host: string; port: number } | undefined;
      let knownTargetKeys = new Set<string>();

      const logNewTargets = (): void => {
        if (!devServerAddress) {
          return;
        }
        const { host, port } = devServerAddress;
        const currentKeys = new Set<string>();

        for (const target of listInspectorTargets(transport)) {
          const key = `${target.logicalDeviceId}:${target.sessionId}`;
          currentKeys.add(key);
          if (knownTargetKeys.has(key)) {
            continue;
          }

          const url = buildDevToolsUrl(host, port, {
            logicalDeviceId: target.logicalDeviceId,
            sessionId: target.sessionId,
            appId: target.client.appName,
          });
          logger.info(
            `[Rozenite Lynx] DevTools available for "${target.client.appName}" on ` +
              `${target.client.deviceName}: ${url}`,
          );
        }

        knownTargetKeys = currentKeys;
      };

      const unsubscribeTopologyLogging = transport.onTopologyChanged(logNewTargets);

      api.onAfterStartDevServer(({ port }) => {
        devServerAddress = { host: toBrowsableHost(api.getNormalizedConfig().server.host), port };
        // Devices discovered before the server finished starting (USB
        // discovery in `createLynxTransport` begins immediately, on its
        // own schedule) would otherwise never get logged: their
        // `onTopologyChanged` event already fired while `devServerAddress`
        // was still unset.
        logNewTargets();
      });

      api.onCloseDevServer(async () => {
        unsubscribeTopologyLogging();
        await server.dispose();
        await transport.dispose();
        await rozenite.dispose();
      });
    },
  };
};
