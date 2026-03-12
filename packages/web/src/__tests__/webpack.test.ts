import { describe, expect, it } from 'vitest';
import {
  withRozeniteWeb,
  type WebpackConfig,
  type WebpackConfigExport,
} from '../webpack/index.js';

const createWebpackConfig = (
  overrides: Partial<WebpackConfig> = {},
): WebpackConfig => ({
  mode: 'development',
  entry: './src/index.tsx',
  ...overrides,
});

describe('withRozeniteWeb (webpack)', () => {
  it('adds websocket and http proxies for the full RN dev-middleware surface', () => {
    const result = withRozeniteWeb(createWebpackConfig(), {
      metroUrl: 'http://localhost:8081',
    }) as WebpackConfig;

    expect(result.devServer?.proxy).toEqual([
      {
        context: '/inspector/device',
        target: 'http://localhost:8081',
        changeOrigin: false,
        ws: true,
      },
      {
        context: '/inspector/debug',
        target: 'http://localhost:8081',
        changeOrigin: false,
        ws: true,
      },
      {
        context: '/open-debugger',
        target: 'http://localhost:8081',
        changeOrigin: false,
      },
      {
        context: '/debugger-frontend',
        target: 'http://localhost:8081',
        changeOrigin: false,
      },
      {
        context: '/json',
        target: 'http://localhost:8081',
        changeOrigin: false,
      },
      {
        context: '/json/list',
        target: 'http://localhost:8081',
        changeOrigin: false,
      },
      {
        context: '/json/version',
        target: 'http://localhost:8081',
        changeOrigin: false,
      },
    ]);
  });

  it('preserves existing devServer options and prepends proxy entries to proxy arrays', () => {
    const originalHistoryFallback = { index: '/index.html' };
    const originalProxy = [{ context: '/api', target: 'http://localhost:3000' }];

    const result = withRozeniteWeb(
      createWebpackConfig({
        devServer: {
          historyApiFallback: originalHistoryFallback,
          proxy: originalProxy,
        },
      }),
      {
        metroUrl: 'http://localhost:8081',
      },
    ) as WebpackConfig;

    expect(result.devServer?.historyApiFallback).toBe(originalHistoryFallback);
    expect(Array.isArray(result.devServer?.proxy)).toBe(true);
    expect((result.devServer?.proxy as unknown[]).at(-1)).toBe(originalProxy[0]);
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
        metroUrl: 'http://localhost:8081',
      },
    ) as WebpackConfig;

    expect(result.devServer?.proxy).toMatchObject({
      '/inspector/device': {
        target: 'http://localhost:8081',
        changeOrigin: false,
        ws: true,
      },
      '/debugger-frontend': {
        target: 'http://localhost:8081',
        changeOrigin: false,
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    });
  });

  it('injects @rozenite/web into string entries', () => {
    const result = withRozeniteWeb(
      createWebpackConfig({
        entry: './src/index.tsx',
      }),
      {
        metroUrl: 'http://localhost:8081',
      },
    ) as WebpackConfig;

    expect(result.entry).toEqual(['@rozenite/web', './src/index.tsx']);
  });

  it('injects @rozenite/web into object entries with import arrays', () => {
    const result = withRozeniteWeb(
      createWebpackConfig({
        entry: {
          app: {
            import: ['./src/index.tsx'],
            filename: 'app.js',
          },
        },
      }),
      {
        metroUrl: 'http://localhost:8081',
      },
    ) as WebpackConfig;

    expect(result.entry).toEqual({
      app: {
        import: ['@rozenite/web', './src/index.tsx'],
        filename: 'app.js',
      },
    });
  });

  it('does not duplicate @rozenite/web when already present in the entry', () => {
    const result = withRozeniteWeb(
      createWebpackConfig({
        entry: ['@rozenite/web', './src/index.tsx'],
      }),
      {
        metroUrl: 'http://localhost:8081',
      },
    ) as WebpackConfig;

    expect(result.entry).toEqual(['@rozenite/web', './src/index.tsx']);
  });

  it('can skip entry injection', () => {
    const result = withRozeniteWeb(
      createWebpackConfig({
        entry: './src/index.tsx',
      }),
      {
        metroUrl: 'http://localhost:8081',
        injectEntry: false,
      },
    ) as WebpackConfig;

    expect(result.entry).toBe('./src/index.tsx');
  });

  it('adds a plugin that rewrites ReactNativeFeatureFlags imports', () => {
    const result = withRozeniteWeb(createWebpackConfig(), {
      metroUrl: 'http://localhost:8081',
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
                    beforeResolve: (resolveData: { request: string }) => {
                      request: string;
                    },
                  ) => void;
                };
              };
            }) => void,
          ) => {
            callback({
              hooks: {
                beforeResolve: {
                  tap: (_pluginName, beforeResolve) => {
                    const resolved = beforeResolve({
                      request:
                        'react-native/src/private/featureflags/ReactNativeFeatureFlags',
                    });

                    expect(resolved.request).toBe(
                      '@rozenite/web/ReactNativeFeatureFlags',
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

  it('returns production configs unchanged', () => {
    const config = createWebpackConfig({
      mode: 'production',
      devServer: {
        proxy: [{ context: '/api', target: 'http://localhost:3000' }],
      },
      plugins: [{ name: 'existing-plugin' }],
    });

    const result = withRozeniteWeb(config, {
      metroUrl: 'http://localhost:8081',
    }) as WebpackConfig;

    expect(result).toBe(config);
  });

  it('supports async webpack config factories', async () => {
    const configFactory: WebpackConfigExport = async (_env, argv) => ({
      mode: argv?.mode,
      entry: './src/index.tsx',
    });

    const resultFactory = withRozeniteWeb(configFactory, {
      metroUrl: 'http://localhost:8081',
    }) as Exclude<WebpackConfigExport, WebpackConfig | Promise<WebpackConfig>>;

    const result = await resultFactory({}, { mode: 'development' });

    expect(result.entry).toEqual(['@rozenite/web', './src/index.tsx']);
    expect(result.devServer?.proxy).toBeDefined();
  });
});
