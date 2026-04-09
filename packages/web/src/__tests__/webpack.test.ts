import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import {
  withRozeniteWeb,
  type WebpackConfig,
  type WebpackConfigExport,
} from '../webpack/index.js';

const require = createRequire(import.meta.url);
const reactNativeFeatureFlagsReplacement = (() => {
  for (const candidate of [
    '../metro/ReactNativeFeatureFlags.js',
    '../metro/ReactNativeFeatureFlags.ts',
  ]) {
    try {
      return require.resolve(candidate);
    } catch {
      continue;
    }
  }

  throw new Error('Unable to resolve test ReactNativeFeatureFlags shim');
})();

const openDebuggerShortcutSymbol = Symbol.for(
  'rozenite.web.openDebuggerShortcut',
);

const createWebpackConfig = (
  overrides: Partial<WebpackConfig> = {},
): WebpackConfig => ({
  mode: 'development',
  entry: './src/index.tsx',
  ...overrides,
});

describe('withRozeniteWeb (webpack)', () => {
  it('is a noop by default', () => {
    const config = createWebpackConfig();

    const result = withRozeniteWeb(config) as WebpackConfig;

    expect(result).toBe(config);
  });

  it('does not inject dev-middleware endpoint proxies', () => {
    const result = withRozeniteWeb(createWebpackConfig(), {
      enabled: true,
    }) as WebpackConfig;

    expect(result.devServer?.proxy).toEqual([]);
  });

  it('does not mutate entry configuration', () => {
    const config = createWebpackConfig({
      entry: './src/index.tsx',
    });

    const result = withRozeniteWeb(config, {
      enabled: true,
    }) as WebpackConfig;

    expect(result.entry).toBe('./src/index.tsx');
  });

  it('preserves existing devServer options without prepending proxy entries', () => {
    const originalHistoryFallback = { index: '/index.html' };
    const originalProxy = [
      { context: '/api', target: 'http://localhost:3000' },
    ];

    const result = withRozeniteWeb(
      createWebpackConfig({
        devServer: {
          historyApiFallback: originalHistoryFallback,
          proxy: originalProxy,
        },
      }),
      {
        enabled: true,
      },
    ) as WebpackConfig;

    expect(result.devServer?.historyApiFallback).toBe(originalHistoryFallback);
    expect(Array.isArray(result.devServer?.proxy)).toBe(true);
    expect(result.devServer?.proxy).toBe(originalProxy);
  });

  it('prepends local dev-middleware and preserves existing setupMiddlewares', () => {
    const middlewares: unknown[] = [];
    const setupMiddlewares = vi.fn(
      (inputMiddlewares: unknown[]) => inputMiddlewares,
    );
    const serverOn = vi.fn();

    const result = withRozeniteWeb(
      createWebpackConfig({
        devServer: {
          setupMiddlewares,
        },
      }),
      {
        enabled: true,
      },
    ) as WebpackConfig;

    const returnedMiddlewares = result.devServer?.setupMiddlewares?.(
      middlewares,
      {
        app: {},
        options: {
          host: '0.0.0.0',
          port: 3000,
        },
        server: {
          on: serverOn,
        },
      } as never,
    );

    expect(middlewares).toHaveLength(1);
    expect(typeof middlewares[0]).toBe('function');
    expect(setupMiddlewares).toHaveBeenCalledWith(
      middlewares,
      expect.objectContaining({
        app: {},
      }),
    );
    expect(returnedMiddlewares).toBe(middlewares);
    expect(serverOn).toHaveBeenCalledWith('upgrade', expect.any(Function));
  });

  it('registers a j shortcut on dev-server startup and preserves existing onListening', () => {
    const onListening = vi.fn();
    const stdinOn = vi.spyOn(process.stdin, 'on');

    delete (
      globalThis as typeof globalThis & {
        [openDebuggerShortcutSymbol]?: unknown;
      }
    )[openDebuggerShortcutSymbol];

    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: true,
    });

    try {
      const result = withRozeniteWeb(
        createWebpackConfig({
          devServer: {
            onListening,
          },
        }),
        {
          enabled: true,
        },
      ) as WebpackConfig;

      const devServer = {
        options: {
          host: '0.0.0.0',
          port: 3000,
        },
      };

      result.devServer?.onListening?.(devServer as never);

      expect(stdinOn).toHaveBeenCalledWith('keypress', expect.any(Function));
      expect(onListening).toHaveBeenCalledWith(devServer);
    } finally {
      stdinOn.mockRestore();
    }
  });

  it('restores SIGINT when Ctrl+C is pressed in raw mode', () => {
    const stdinOn = vi.spyOn(process.stdin, 'on');
    const processKill = vi
      .spyOn(process, 'kill')
      .mockImplementation(() => true);

    delete (
      globalThis as typeof globalThis & {
        [openDebuggerShortcutSymbol]?: unknown;
      }
    )[openDebuggerShortcutSymbol];

    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: true,
    });

    try {
      const result = withRozeniteWeb(createWebpackConfig(), {
        enabled: true,
      }) as WebpackConfig;

      result.devServer?.onListening?.({
        options: {
          host: '0.0.0.0',
          port: 3000,
        },
      } as never);

      const [, keypressHandler] = stdinOn.mock.calls.at(-1) as [
        string,
        (str: string, key: { ctrl?: boolean; name?: string }) => void,
      ];

      keypressHandler('\u0003', { ctrl: true, name: 'c' });

      expect(processKill).toHaveBeenCalledWith(process.pid, 'SIGINT');
    } finally {
      processKill.mockRestore();
      stdinOn.mockRestore();
    }
  });

  it('uses the Metro-style POST flow when j is pressed', async () => {
    const stdinOn = vi.spyOn(process.stdin, 'on');
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = input instanceof URL ? input.toString() : String(input);

      if (url === 'http://localhost:3000/json/list') {
        expect(init).toEqual({ method: 'POST' });
        return new Response(
          JSON.stringify([
            {
              id: 'web-target',
              title: 'React Native Web',
              description: 'localhost:3000',
            },
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      if (url === 'http://localhost:3000/open-debugger?target=web-target') {
        expect(init).toEqual({ method: 'POST' });
        return new Response(null, { status: 200 });
      }

      throw new Error(`Unexpected fetch url: ${url}`);
    });

    const originalFetch = global.fetch;
    global.fetch = fetchMock;

    delete (
      globalThis as typeof globalThis & {
        [openDebuggerShortcutSymbol]?: unknown;
      }
    )[openDebuggerShortcutSymbol];

    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: true,
    });

    try {
      const result = withRozeniteWeb(createWebpackConfig(), {
        enabled: true,
      }) as WebpackConfig;

      result.devServer?.onListening?.({
        options: {
          host: '0.0.0.0',
          port: 3000,
        },
      } as never);

      const [, keypressHandler] = stdinOn.mock.calls.at(-1) as [
        string,
        (str: string, key: { ctrl?: boolean; name?: string }) => void,
      ];

      keypressHandler('j', { name: 'j' });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        new URL('/json/list', 'http://localhost:3000'),
        { method: 'POST' },
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        new URL('/open-debugger?target=web-target', 'http://localhost:3000'),
        { method: 'POST' },
      );
    } finally {
      global.fetch = originalFetch;
      stdinOn.mockRestore();
    }
  });

  it('triggers webpack invalidation when R is pressed', async () => {
    const stdinOn = vi.spyOn(process.stdin, 'on');
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = input instanceof URL ? input.toString() : String(input);

      if (url === 'http://localhost:3000/webpack-dev-server/invalidate') {
        return new Response(null, { status: 200 });
      }

      throw new Error(`Unexpected fetch url: ${url}`);
    });

    const originalFetch = global.fetch;
    global.fetch = fetchMock;

    delete (
      globalThis as typeof globalThis & {
        [openDebuggerShortcutSymbol]?: unknown;
      }
    )[openDebuggerShortcutSymbol];

    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: true,
    });

    try {
      const result = withRozeniteWeb(createWebpackConfig(), {
        enabled: true,
      }) as WebpackConfig;

      result.devServer?.onListening?.({
        options: {
          host: '0.0.0.0',
          port: 3000,
        },
      } as never);

      const [, keypressHandler] = stdinOn.mock.calls.at(-1) as [
        string,
        (str: string, key: { ctrl?: boolean; name?: string }) => void,
      ];

      keypressHandler('r', { name: 'r' });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(fetchMock).toHaveBeenCalledWith(
        new URL('/webpack-dev-server/invalidate', 'http://localhost:3000'),
      );
    } finally {
      global.fetch = originalFetch;
      stdinOn.mockRestore();
    }
  });

  it('merges proxy object configs without clobbering unrelated entries', () => {
    const result = withRozeniteWeb(
      createWebpackConfig({
        devServer: {
          proxy: {
            '/api': {
              target: 'http://localhost:3000',
              changeOrigin: true,
            },
          },
        },
      }),
      {
        enabled: true,
      },
    ) as WebpackConfig;

    expect(result.devServer?.proxy).toEqual({
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    });
  });

  it('adds a plugin that rewrites ReactNativeFeatureFlags imports', () => {
    const result = withRozeniteWeb(createWebpackConfig(), {
      enabled: true,
    }) as WebpackConfig;

    const compilerMock = {
      hooks: {
        normalModuleFactory: {
          tap: (
            _name: string,
            callback: (normalModuleFactory: {
              hooks: {
                beforeResolve: {
                  tap: (
                    _pluginName: string,
                    beforeResolve: (resolveData: { request: string }) => void,
                  ) => void;
                };
              };
            }) => void,
          ) => {
            callback({
              hooks: {
                beforeResolve: {
                  tap: (_pluginName, beforeResolve) => {
                    const resolved = {
                      request:
                        'react-native/src/private/featureflags/ReactNativeFeatureFlags',
                    };

                    beforeResolve(resolved);

                    expect(resolved.request).toBe(
                      reactNativeFeatureFlagsReplacement,
                    );
                  },
                },
              },
            });
          },
        },
      },
    };

    expect(result.plugins).toHaveLength(1);
    (
      result.plugins?.[0] as {
        apply: (compiler: typeof compilerMock) => void;
      }
    ).apply(compilerMock);
  });

  it('keeps production configs free of dev-server integration', () => {
    const config = createWebpackConfig({
      mode: 'production',
      devServer: {
        proxy: [{ context: '/api', target: 'http://localhost:3000' }],
      },
      plugins: [{ name: 'existing-plugin' }],
    });

    const result = withRozeniteWeb(config, {
      enabled: true,
    }) as WebpackConfig;

    expect(result).not.toBe(config);
    expect(result.devServer).toBe(config.devServer);
    expect(result.plugins).toEqual([
      { name: 'existing-plugin' },
      expect.objectContaining({
        apply: expect.any(Function),
      }),
    ]);
  });

  it('keeps production configs unchanged when disabled explicitly', () => {
    const config = createWebpackConfig({
      mode: 'production',
    });

    const result = withRozeniteWeb(config, {
      enabled: false,
    }) as WebpackConfig;

    expect(result).toBe(config);
  });

  it('supports async webpack config factories', async () => {
    const configFactory: WebpackConfigExport = async (_env, argv) => ({
      mode: argv?.mode,
      entry: './src/index.tsx',
    });

    const resultFactory = withRozeniteWeb(configFactory) as Exclude<
      WebpackConfigExport,
      WebpackConfig | Promise<WebpackConfig>
    >;

    const result = await resultFactory({}, { mode: 'development' });

    expect(result.entry).toEqual('./src/index.tsx');
    expect(result.devServer).toBeUndefined();
  });

  it('supports async webpack config factories when enabled', async () => {
    const configFactory: WebpackConfigExport = async (_env, argv) => ({
      mode: argv?.mode,
      entry: './src/index.tsx',
    });

    const resultFactory = withRozeniteWeb(configFactory, {
      enabled: true,
    }) as Exclude<WebpackConfigExport, WebpackConfig | Promise<WebpackConfig>>;

    const result = await resultFactory({}, { mode: 'development' });

    expect(result.entry).toEqual('./src/index.tsx');
    expect(result.devServer?.proxy).toBeDefined();
  });
});
