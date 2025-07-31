import { type MetroConfig } from '@react-native/metro-config';
import { initializeRozenite, type RozeniteConfig } from '@rozenite/middleware';

export type RozeniteMetroConfig = Omit<RozeniteConfig, 'projectRoot'>;

export const withRozenite = async <T extends MetroConfig>(
  config: T | Promise<T>,
  options: RozeniteMetroConfig = {}
): Promise<T> => {
  const resolvedConfig = await config;
  const { devModePackage, middleware: rozeniteMiddleware } = initializeRozenite(
    {
      projectRoot: resolvedConfig.projectRoot ?? process.cwd(),
      ...options,
    }
  );

  return {
    ...resolvedConfig,
    watchFolders: devModePackage
      ? [...(resolvedConfig.watchFolders ?? []), devModePackage.path]
      : resolvedConfig.watchFolders,
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
