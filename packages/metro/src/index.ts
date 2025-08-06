import { type MetroConfig } from '@react-native/metro-config';
import { initializeRozenite, type RozeniteConfig } from '@rozenite/middleware';

export type RozeniteMetroConfig = Omit<RozeniteConfig, 'projectRoot'>;

export const withRozenite = async <T extends MetroConfig>(
  config: T | Promise<T>,
  options: RozeniteMetroConfig = {}
): Promise<T> => {
  const resolvedConfig = await config;
  const projectRoot = resolvedConfig.projectRoot ?? process.cwd();
  const { devModePackage, middleware: rozeniteMiddleware } = initializeRozenite(
    {
      projectRoot,
      ...options,
    }
  );

  return {
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
            react: require.resolve('react', { paths: [projectRoot] }),
            'react-native': require.resolve('react-native', {
              paths: [projectRoot],
            }),
          }
        : resolvedConfig.resolver?.extraNodeModules,
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
};
