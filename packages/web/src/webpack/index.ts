const ROZENITE_WEB_ENTRY = '@rozenite/web';
const REACT_NATIVE_FEATURE_FLAGS_REPLACEMENT =
  '@rozenite/web/ReactNativeFeatureFlags';

const DEV_MIDDLEWARE_WS_ENDPOINTS = ['/inspector/device', '/inspector/debug'];
const DEV_MIDDLEWARE_HTTP_ENDPOINTS = [
  '/open-debugger',
  '/debugger-frontend',
  '/json',
  '/json/list',
  '/json/version',
];

const REACT_NATIVE_FEATURE_FLAGS_PATTERN = /ReactNativeFeatureFlags(?:\.js)?$/;

type WebpackMode = 'development' | 'production' | 'none' | string;

type WebpackEntryDescription = {
  import?: string | string[];
  [key: string]: unknown;
};

type WebpackEntryValue = string | string[] | WebpackEntryDescription;

type WebpackEntry =
  | string
  | string[]
  | WebpackEntryDescription
  | Record<string, WebpackEntryValue>;

type WebpackResolve = {
  alias?: Record<string, string>;
  [key: string]: unknown;
};

type DevServerProxyEntry = {
  context?: string | string[];
  target?: string;
  changeOrigin?: boolean;
  ws?: boolean;
  [key: string]: unknown;
};

type DevServerProxy =
  | DevServerProxyEntry[]
  | Record<string, string | DevServerProxyEntry>;

type WebpackDevServer = {
  proxy?: DevServerProxy;
  [key: string]: unknown;
};

export type WebpackConfig = {
  mode?: WebpackMode;
  entry?: WebpackEntry;
  resolve?: WebpackResolve;
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
  metroUrl: string;
  injectEntry?: boolean;
};

type WebpackCompiler = {
  hooks: {
    normalModuleFactory: {
      tap: (
        name: string,
        callback: (normalModuleFactory: WebpackNormalModuleFactory) => void,
      ) => void;
    };
  };
};

type WebpackNormalModuleFactory = {
  hooks: {
    beforeResolve: {
      tap: (
        name: string,
        callback: (
          resolveData: WebpackBeforeResolveData | undefined,
        ) => WebpackBeforeResolveData | false | undefined,
      ) => void;
    };
  };
};

type WebpackBeforeResolveData = {
  request: string;
  [key: string]: unknown;
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

            return resolveData;
          },
        );
      },
    );
  }
}

const isProductionMode = (mode: WebpackMode | undefined) => mode === 'production';

const injectRozeniteImport = (value: string | string[]): string | string[] => {
  if (typeof value === 'string') {
    return value === ROZENITE_WEB_ENTRY ? value : [ROZENITE_WEB_ENTRY, value];
  }

  return value.includes(ROZENITE_WEB_ENTRY)
    ? value
    : [ROZENITE_WEB_ENTRY, ...value];
};

const injectRozeniteEntry = (value: WebpackEntryValue): WebpackEntryValue => {
  if (typeof value === 'string' || Array.isArray(value)) {
    return injectRozeniteImport(value);
  }

  if (value.import == null) {
    return value;
  }

  return {
    ...value,
    import: injectRozeniteImport(value.import),
  };
};

const patchEntry = (
  entry: WebpackConfig['entry'],
  injectEntry: boolean,
): WebpackConfig['entry'] => {
  if (!injectEntry || entry == null) {
    return entry;
  }

  if (
    typeof entry === 'string' ||
    Array.isArray(entry) ||
    'import' in entry
  ) {
    return injectRozeniteEntry(entry);
  }

  return Object.fromEntries(
    Object.entries(entry).map(([key, value]) => [
      key,
      injectRozeniteEntry(value as WebpackEntryValue),
    ]),
  );
};

const createProxyEntries = (metroUrl: string): DevServerProxyEntry[] => [
  ...DEV_MIDDLEWARE_WS_ENDPOINTS.map((context) => ({
    context,
    target: metroUrl,
    changeOrigin: false,
    ws: true,
  })),
  ...DEV_MIDDLEWARE_HTTP_ENDPOINTS.map((context) => ({
    context,
    target: metroUrl,
    changeOrigin: false,
  })),
];

const mergeProxyConfig = (
  proxy: DevServerProxy | undefined,
  metroUrl: string,
): DevServerProxy => {
  const rozeniteProxyEntries = createProxyEntries(metroUrl);

  if (proxy == null) {
    return rozeniteProxyEntries;
  }

  if (Array.isArray(proxy)) {
    return [...rozeniteProxyEntries, ...proxy];
  }

  const rozeniteProxyObject = Object.fromEntries(
    rozeniteProxyEntries.map((entry) => [
      entry.context as string,
      Object.fromEntries(
        Object.entries(entry).filter(([key]) => key !== 'context'),
      ),
    ]),
  );

  return {
    ...rozeniteProxyObject,
    ...proxy,
  };
};

const hasRozeniteWebpackPlugin = (plugins: unknown[] | undefined) =>
  plugins?.some((plugin) => plugin instanceof RozeniteWebpackPlugin) ?? false;

const patchConfig = (
  config: WebpackConfig,
  argvMode: WebpackMode | undefined,
  options: RozeniteWebpackOptions,
): WebpackConfig => {
  const resolvedMode = argvMode ?? config.mode;

  if (isProductionMode(resolvedMode)) {
    return config;
  }

  return {
    ...config,
    entry: patchEntry(config.entry, options.injectEntry ?? true),
    devServer: {
      ...config.devServer,
      proxy: mergeProxyConfig(config.devServer?.proxy, options.metroUrl),
    },
    resolve: {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
      },
    },
    plugins: hasRozeniteWebpackPlugin(config.plugins)
      ? config.plugins
      : [...(config.plugins ?? []), new RozeniteWebpackPlugin()],
  };
};

export const withRozeniteWeb = (
  config: WebpackConfigExport,
  options: RozeniteWebpackOptions,
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
