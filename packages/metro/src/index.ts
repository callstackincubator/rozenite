import { type MetroConfig } from 'metro-config';
import { patchDevtoolsFrontendUrl } from './dev-tools-url-patch.js';
import { getMiddleware } from './middleware.js';
import { logger } from './logger.js';
import { getInstalledPlugins } from './auto-discovery.js';
import { RozeniteMetroConfig } from './config.js';
import { enableDevModeIfNeeded } from './dev-mode.js';

export const withRozenite = async <T extends MetroConfig>(
  config: T | Promise<T>,
  options: RozeniteMetroConfig = {}
): Promise<T> => {
  const resolvedConfig = await config;

  enableDevModeIfNeeded(options, resolvedConfig);

  const allInstalledPlugins = await getInstalledPlugins(options);

  if (allInstalledPlugins.length === 0) {
    logger.info('No plugins found.');
  } else {
    logger.info(`Loaded ${allInstalledPlugins.length} plugin(s):`);
    allInstalledPlugins.forEach((plugin) => {
      logger.info(`  - ${plugin.name}`);
    });
  }

  patchDevtoolsFrontendUrl();

  return {
    ...resolvedConfig,
    server: {
      ...resolvedConfig.server,
      enhanceMiddleware: (metroMiddleware, server) => {
        const customMiddleware = getMiddleware(allInstalledPlugins);
        const prevMiddleware =
          resolvedConfig.server?.enhanceMiddleware?.(metroMiddleware, server) ??
          metroMiddleware;

        return customMiddleware.use(prevMiddleware);
      },
    },
  } satisfies MetroConfig;
};
