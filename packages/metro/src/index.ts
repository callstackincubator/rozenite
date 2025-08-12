import { type MetroConfig } from '@react-native/metro-config';
import { initializeRozenite, type RozeniteConfig } from '@rozenite/middleware';
import path from 'node:path';
import { isBundling } from './is-bundling.js';

export type RozeniteMetroConfig<TMetroConfig = unknown> = Omit<
  RozeniteConfig,
  'projectRoot'
> & {
  /**
   * Certain Rozenite plugins require Metro to be configured in a specific way.
   * This option allows you to modify the Metro config in a way that is safe to do when bundling.
   */
  enhanceMetroConfig?: (
    config: TMetroConfig
  ) => Promise<TMetroConfig> | TMetroConfig;
};

export const withRozenite = async <T extends MetroConfig>(
  config: T | Promise<T>,
  options: RozeniteMetroConfig<T> = {}
): Promise<T> => {
  const resolvedConfig = await config;
  const projectRoot = resolvedConfig.projectRoot ?? process.cwd();

  if (isBundling(projectRoot)) {
    console.info('[Rozenite] Skipping initialization for bundling');
    return resolvedConfig;
  }

  const { devModePackage, middleware: rozeniteMiddleware } = initializeRozenite(
    {
      projectRoot,
      ...options,
    }
  );

  const rozeniteMetroConfig = {
    ...resolvedConfig,
    watchFolders: devModePackage
      ? [...(resolvedConfig.watchFolders ?? []), devModePackage.path]
      : resolvedConfig.watchFolders,
    resolver: {
      ...resolvedConfig.resolver,
      extraNodeModules: devModePackage
        ? {
            ...(resolvedConfig.resolver?.extraNodeModules ?? {}),
            [devModePackage.name]: require.resolve(devModePackage.name, {
              paths: [projectRoot],
            }),

            // Rozenite package should use the same versions of React and React Native as the app.
            // Using dirname as sometimes developers use deep imports for react-native.
            react: path.dirname(
              require.resolve('react', { paths: [projectRoot] })
            ),
            'react-native': path.dirname(
              require.resolve('react-native', {
                paths: [projectRoot],
              })
            ),
          }
        : resolvedConfig.resolver?.extraNodeModules,
      resolveRequest: (context, moduleName, platform) => {
        // Unfortunately, 'web' doesn't include certain internal modules like 'react-native/Libraries/WebSocket/WebSocketInterceptor'.
        // This is currently the only module that we need to mock, but it may change in the future.
        if (
          moduleName === 'react-native/Libraries/WebSocket/WebSocketInterceptor'
        ) {
          return {
            type: 'empty',
          };
        }

        return (
          resolvedConfig.resolver?.resolveRequest?.(
            context,
            moduleName,
            platform
          ) ?? context.resolveRequest(context, moduleName, platform)
        );
      },
    },
    server: {
      ...resolvedConfig.server,
      enhanceMiddleware: (metroMiddleware, server) => {
        const prevMiddleware =
          resolvedConfig.server?.enhanceMiddleware?.(metroMiddleware, server) ??
          metroMiddleware;

        return rozeniteMiddleware.use(prevMiddleware);
      },
    },
  } satisfies MetroConfig;

  if (options.enhanceMetroConfig) {
    const enhancedConfig = await options.enhanceMetroConfig(
      rozeniteMetroConfig
    );
    return enhancedConfig;
  }

  return rozeniteMetroConfig;
};
