import { type MetroConfig } from 'metro-config';
import { patchDevtoolsFrontendUrl } from './dev-tools-url-patch.js';
import { getMiddleware } from './middleware.js';
import { logger } from './logger.js';
import { getInstalledPlugins } from './auto-discovery.js';

export const withDebuggerFramework = async (
  config: MetroConfig | Promise<MetroConfig>
) => {
  const resolvedConfig = await config;
  const allInstalledPlugins = await getInstalledPlugins();

  if (allInstalledPlugins.length === 0) {
    logger.info('No plugins found.');
    return resolvedConfig;
  }

  logger.info(`Loaded ${allInstalledPlugins.length} plugin(s):`);
  allInstalledPlugins.forEach((plugin) => {
    logger.info(`  - ${plugin.name}`);
  });

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
