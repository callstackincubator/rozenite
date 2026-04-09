import { createRequire } from 'node:module';
import * as readline from 'node:readline';
import { ReadStream } from 'node:tty';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

const getNodeRequire = () => {
  if (typeof require === 'function') {
    return require;
  }

  return createRequire(Function('return import.meta.url')() as string);
};

const nodeRequire = getNodeRequire();

const resolveReactNativeFeatureFlagsReplacement = () => {
  for (const candidate of [
    '../metro/ReactNativeFeatureFlags.js',
    '../metro/ReactNativeFeatureFlags.ts',
  ]) {
    try {
      return nodeRequire.resolve(candidate);
    } catch {
      continue;
    }
  }

  throw new Error('Unable to resolve Rozenite ReactNativeFeatureFlags shim');
};

const REACT_NATIVE_FEATURE_FLAGS_REPLACEMENT =
  resolveReactNativeFeatureFlagsReplacement();

const CTRL_C = '\u0003';
const CTRL_D = '\u0004';
const OPEN_DEBUGGER_SHORTCUT = 'j';
const RELOAD_SHORTCUT = 'r';
const ROZENITE_OPEN_DEBUGGER_SHORTCUT = Symbol.for(
  'rozenite.web.openDebuggerShortcut',
);
const ROZENITE_WEBPACK_DEV_MIDDLEWARE = Symbol.for(
  'rozenite.web.webpackDevMiddleware',
);

const REACT_NATIVE_FEATURE_FLAGS_PATTERN = /ReactNativeFeatureFlags(?:\.js)?$/;

const registeredUpgradeServers = new WeakSet<object>();

type WebpackMode = 'development' | 'production' | 'none' | string;

type WebpackEntryImport = string | string[];

type WebpackEntryDescription = {
  import?: string | string[];
  [key: string]: unknown;
};

type WebpackEntryValue = WebpackEntryImport | WebpackEntryDescription;

type WebpackEntry =
  | WebpackEntryImport
  | WebpackEntryDescription
  | Record<string, WebpackEntryValue>;

type DevServerProxy =
  | Record<string, string | Record<string, unknown>>
  | Array<Record<string, unknown>>;

type UpgradeHandler = (
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
) => void;

type WebpackDevServer = {
  proxy?: DevServerProxy;
  setupMiddlewares?: (
    middlewares: unknown[],
    devServer?: { app?: unknown },
  ) => unknown[];
  onListening?: (devServer: WebpackDevServerRuntime) => void;
  [key: string]: unknown;
};

type WebpackDevServerRuntime = {
  app?: unknown;
  options: {
    host?: string;
    port?: number | string;
  };
  server?: {
    on: (event: 'upgrade', handler: UpgradeHandler) => void;
  };
};

type DebugTarget = {
  id: string;
  title: string;
  description: string;
};

type OpenDebuggerShortcutState = {
  installedUrls: Set<string>;
};

type DevMiddlewareApi = {
  middleware: (
    req: {
      method?: string;
      url?: string;
      headers: Record<string, string | string[] | undefined>;
      query?: Record<string, string | string[] | undefined>;
    },
    res: {
      redirect: (status: number, url: string) => void;
      status: (statusCode: number) => {
        send: (body: string) => void;
      };
    },
    next: () => void,
  ) => void | Promise<void>;
  websocketEndpoints: Record<
    string,
    {
      handleUpgrade: (
        request: IncomingMessage,
        socket: Duplex,
        head: Buffer,
        callback: (client: unknown, upgradedRequest: IncomingMessage) => void,
      ) => void;
      emit: (
        event: 'connection',
        client: unknown,
        upgradedRequest: IncomingMessage,
      ) => void;
    }
  >;
};

type CreateLocalDevMiddleware = (options: {
  serverBaseUrl: string;
  unstable_experiments?: {
    enableOpenDebuggerRedirect?: boolean;
  };
}) => unknown;

export type WebpackConfig = {
  mode?: WebpackMode;
  entry?: WebpackEntry;
  resolve?: Record<string, unknown>;
  plugins?: unknown[];
  devServer?: WebpackDevServer;
  [key: string]: unknown;
};

type WebpackConfigFactoryArgs = {
  mode?: WebpackMode;
  [key: string]: unknown;
};

export type WebpackConfigExport =
  | WebpackConfig
  | Promise<WebpackConfig>
  | ((
      env?: Record<string, unknown>,
      argv?: WebpackConfigFactoryArgs,
    ) => WebpackConfig | Promise<WebpackConfig>);

export type RozeniteWebpackOptions = {
  devServer?: boolean;
};

type WebpackCompiler = {
  hooks: {
    normalModuleFactory: {
      tap: (
        name: string,
        callback: (normalModuleFactory: {
          hooks: {
            beforeResolve: {
              tap: (
                name: string,
                callback: (
                  resolveData:
                    | { request: string; [key: string]: unknown }
                    | undefined,
                ) => false | void,
              ) => void;
            };
          };
        }) => void,
      ) => void;
    };
  };
};

class RozeniteWebpackPlugin {
  apply(compiler: WebpackCompiler) {
    compiler.hooks.normalModuleFactory.tap(
      'RozeniteWebpackPlugin',
      (normalModuleFactory) => {
        normalModuleFactory.hooks.beforeResolve.tap(
          'RozeniteWebpackPlugin',
          (resolveData) => {
            if (
              resolveData &&
              REACT_NATIVE_FEATURE_FLAGS_PATTERN.test(resolveData.request)
            ) {
              resolveData.request = REACT_NATIVE_FEATURE_FLAGS_REPLACEMENT;
            }
          },
        );
      },
    );
  }
}

const getDevServerUrl = (
  devServer: WebpackDevServerRuntime | undefined,
): string | null => {
  const host = devServer?.options.host;
  const normalizedHost =
    !host || host === '0.0.0.0' || host === '::' ? 'localhost' : host;
  const port = devServer?.options.port;

  if (typeof port === 'number') {
    return `http://${normalizedHost}:${port}`;
  }

  if (typeof port === 'string' && port !== 'auto' && port.length > 0) {
    return `http://${normalizedHost}:${port}`;
  }

  return null;
};

const getShortcutState = (): OpenDebuggerShortcutState => {
  const globalWithState = globalThis as typeof globalThis & {
    [ROZENITE_OPEN_DEBUGGER_SHORTCUT]?: OpenDebuggerShortcutState;
  };

  if (globalWithState[ROZENITE_OPEN_DEBUGGER_SHORTCUT] == null) {
    globalWithState[ROZENITE_OPEN_DEBUGGER_SHORTCUT] = {
      installedUrls: new Set(),
    };
  }

  return globalWithState[ROZENITE_OPEN_DEBUGGER_SHORTCUT];
};

const setRawMode = (enable: boolean): void => {
  if (!(process.stdin instanceof ReadStream)) {
    return;
  }

  process.stdin.setRawMode(enable);
};

const exitOnCtrlC = (): void => {
  process.kill(process.pid, 'SIGINT');
};

const inverse = (value: string): string =>
  `\u001B[37m\u001B[7m${value}\u001B[27m\u001B[39m`;

const triggerWebpackRebuild = async (devServerUrl: string): Promise<void> => {
  try {
    const response = await fetch(
      new URL('/webpack-dev-server/invalidate', devServerUrl),
    );

    if (!response.ok) {
      throw new Error(`Unexpected status code: ${response.status}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Rozenite] Failed to trigger webpack rebuild: ${message}`);
  }
};

class OpenDebuggerKeyboardHandler {
  #devServerUrl: string;
  #targetsShownForSelection: DebugTarget[] | null = null;

  constructor(devServerUrl: string) {
    this.#devServerUrl = devServerUrl;
  }

  #getFetch(): typeof fetch {
    const fetchFn = globalThis.fetch;
    if (fetchFn == null) {
      throw new Error('Global fetch is unavailable in this Node.js runtime.');
    }

    return fetchFn;
  }

  async #tryOpenDebuggerForTarget(target: DebugTarget): Promise<void> {
    this.#targetsShownForSelection = null;

    try {
      await this.#getFetch()(
        new URL(
          `/open-debugger?target=${encodeURIComponent(target.id)}`,
          this.#devServerUrl,
        ),
        { method: 'POST' },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown network error';
      console.error(
        `[Rozenite] Failed to open debugger for ${target.title} (${target.description}): ${message}`,
      );
    }
  }

  async handleOpenDebugger(): Promise<void> {
    console.info('[Rozenite] Fetching available debugging targets...');
    this.#targetsShownForSelection = null;

    try {
      const response = await this.#getFetch()(
        new URL('/json/list', this.#devServerUrl),
        {
          method: 'POST',
        },
      );

      if (response.status !== 200) {
        throw new Error(`Unexpected status code: ${response.status}`);
      }

      const targets = (await response.json()) as unknown;
      if (!Array.isArray(targets)) {
        throw new Error('Expected array.');
      }

      if (targets.length === 0) {
        console.warn('[Rozenite] No connected targets.');
        return;
      }

      if (targets.length === 1) {
        void this.#tryOpenDebuggerForTarget(targets[0] as DebugTarget);
        return;
      }

      if (targets.length > 9) {
        console.warn(
          '[Rozenite] 10 or more debug targets available, showing the first 9.',
        );
      }

      const targetsShown = targets.slice(0, 9) as DebugTarget[];
      const hasDuplicateTitles =
        new Set(targetsShown.map((target) => target.title)).size <
        targetsShown.length;

      this.#targetsShownForSelection = targetsShown;
      console.info(
        `Multiple debug targets available, please select:\n ${targetsShown
          .map(({ title, description }, index) => {
            const descriptionSuffix = hasDuplicateTitles
              ? ` (${description})`
              : '';

            return `${inverse(` ${index + 1} `)} - "${title}${descriptionSuffix}"`;
          })
          .join('\n ')}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Rozenite] Failed to fetch debug targets: ${message}`);
    }
  }

  maybeHandleTargetSelection(keyName: string | undefined): boolean {
    if (
      keyName != null &&
      keyName >= '1' &&
      keyName <= '9' &&
      this.#targetsShownForSelection != null
    ) {
      const targetIndex = Number(keyName) - 1;
      const target = this.#targetsShownForSelection[targetIndex];

      if (target != null) {
        void this.#tryOpenDebuggerForTarget(target);
        return true;
      }
    }

    return false;
  }

  dismiss(): void {
    this.#targetsShownForSelection = null;
  }
}

const registerDebuggerShortcut = (devServer: WebpackDevServerRuntime): void => {
  if (process.stdin.isTTY !== true) {
    return;
  }

  const devServerUrl = getDevServerUrl(devServer);
  if (!devServerUrl) {
    return;
  }

  const state = getShortcutState();
  if (state.installedUrls.has(devServerUrl)) {
    return;
  }

  state.installedUrls.add(devServerUrl);
  readline.emitKeypressEvents(process.stdin);
  setRawMode(true);
  const openDebuggerKeyboardHandler = new OpenDebuggerKeyboardHandler(
    devServerUrl,
  );

  const onKeypress = (str: string, key: { ctrl?: boolean; name?: string }) => {
    const keyName = key?.name;

    if (openDebuggerKeyboardHandler.maybeHandleTargetSelection(keyName)) {
      return;
    }

    switch (keyName) {
      case OPEN_DEBUGGER_SHORTCUT:
        void openDebuggerKeyboardHandler.handleOpenDebugger();
        break;
      case RELOAD_SHORTCUT:
        void triggerWebpackRebuild(devServerUrl);
        break;
      case 'c':
        if (key?.ctrl) {
          exitOnCtrlC();
        }
        break;
      default:
        switch (str) {
          case CTRL_D:
            openDebuggerKeyboardHandler.dismiss();
            break;
          case CTRL_C:
            exitOnCtrlC();
            break;
          default:
            break;
        }
        break;
    }
  };

  process.stdin.on('keypress', onKeypress);
};

const getDevMiddlewareApi = (devServerUrl: string): DevMiddlewareApi => {
  const globalWithState = globalThis as typeof globalThis & {
    [ROZENITE_WEBPACK_DEV_MIDDLEWARE]?: Map<string, DevMiddlewareApi>;
  };

  if (globalWithState[ROZENITE_WEBPACK_DEV_MIDDLEWARE] == null) {
    globalWithState[ROZENITE_WEBPACK_DEV_MIDDLEWARE] = new Map();
  }

  const cache = globalWithState[ROZENITE_WEBPACK_DEV_MIDDLEWARE];
  const existing = cache.get(devServerUrl);
  if (existing) {
    return existing;
  }

  const { createDevMiddleware } = nodeRequire(
    '@react-native/dev-middleware',
  ) as {
    createDevMiddleware: CreateLocalDevMiddleware;
  };

  const api = createDevMiddleware({
    serverBaseUrl: devServerUrl,
    unstable_experiments: {
      enableOpenDebuggerRedirect: false,
    },
  }) as unknown as DevMiddlewareApi;

  cache.set(devServerUrl, api);
  return api;
};

const registerDevMiddlewareWebSocketEndpoints = (
  devServer: WebpackDevServerRuntime,
  devMiddlewareApi: DevMiddlewareApi,
): void => {
  const server = devServer.server;
  if (!server || registeredUpgradeServers.has(server)) {
    return;
  }

  registeredUpgradeServers.add(server);
  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url
      ? new URL(request.url, 'http://localhost').pathname
      : '';
    const endpoint = devMiddlewareApi.websocketEndpoints[pathname];

    if (!endpoint) {
      return;
    }

    endpoint.handleUpgrade(request, socket, head, (client, upgradedRequest) => {
      endpoint.emit('connection', client, upgradedRequest);
    });
  });
};

const mergeSetupMiddlewares = (
  setupMiddlewares: WebpackDevServer['setupMiddlewares'],
): WebpackDevServer['setupMiddlewares'] => {
  return (middlewares, devServer) => {
    const runtimeDevServer = devServer as WebpackDevServerRuntime | undefined;
    const devServerUrl = getDevServerUrl(runtimeDevServer);

    if (devServerUrl) {
      const devMiddlewareApi = getDevMiddlewareApi(devServerUrl);
      if (runtimeDevServer) {
        registerDevMiddlewareWebSocketEndpoints(
          runtimeDevServer,
          devMiddlewareApi,
        );
      }

      middlewares.unshift(devMiddlewareApi.middleware);
    }

    return setupMiddlewares
      ? setupMiddlewares(middlewares, devServer)
      : middlewares;
  };
};

const hasRozeniteWebpackPlugin = (plugins: unknown[] | undefined) =>
  plugins?.some((plugin) => plugin instanceof RozeniteWebpackPlugin) ?? false;

const patchCompatibilityConfig = (config: WebpackConfig): WebpackConfig => {
  return {
    ...config,
    plugins: hasRozeniteWebpackPlugin(config.plugins)
      ? config.plugins
      : [...(config.plugins ?? []), new RozeniteWebpackPlugin()],
  };
};

const shouldPatchDevServer = (
  config: WebpackConfig,
  argvMode: WebpackMode | undefined,
  options: RozeniteWebpackOptions,
): boolean => {
  if (options.devServer === false) {
    return false;
  }

  const resolvedMode = argvMode ?? config.mode;
  return resolvedMode !== 'production';
};

const patchDevelopmentConfig = (config: WebpackConfig): WebpackConfig => {
  return {
    ...config,
    devServer: {
      ...config.devServer,
      proxy: config.devServer?.proxy ?? [],
      setupMiddlewares: mergeSetupMiddlewares(
        config.devServer?.setupMiddlewares,
      ),
      onListening: (devServer) => {
        registerDebuggerShortcut(devServer);
        config.devServer?.onListening?.(devServer);
      },
    },
  };
};

const patchConfig = (
  config: WebpackConfig,
  argvMode: WebpackMode | undefined,
  options: RozeniteWebpackOptions,
): WebpackConfig => {
  const compatibilityConfig = patchCompatibilityConfig(config);

  return shouldPatchDevServer(compatibilityConfig, argvMode, options)
    ? patchDevelopmentConfig(compatibilityConfig)
    : compatibilityConfig;
};

export const withRozeniteWeb = (
  config: WebpackConfigExport,
  options: RozeniteWebpackOptions = {},
): WebpackConfigExport => {
  if (typeof config === 'function') {
    return async (env, argv) =>
      patchConfig(await config(env, argv), argv?.mode, options);
  }

  if (config instanceof Promise) {
    return config.then((resolvedConfig) =>
      patchConfig(resolvedConfig, resolvedConfig.mode, options),
    );
  }

  return patchConfig(config, config.mode, options);
};
