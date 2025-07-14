import { type MetroConfig } from 'metro-config';
import { getInstalledPluginsFromRegistry } from './plugin-registry.js';
import { patchDevtoolsFrontendUrl } from './dev-tools-url-patch.js';
import { getMiddleware } from './middleware.js';
import { getWebSocketBroadcastServer } from './broadcast.js';
import { isPluginApproved } from './plugin-cache.js';
import { logger } from './logger.js';

const tryResolve = (
  id: string
): ((config: MetroConfig) => MetroConfig) | null => {
  try {
    return require(id);
  } catch {
    return null;
  }
};

export const withDebuggerFramework = async (
  config: MetroConfig | Promise<MetroConfig>
) => {
  const resolvedConfig = await config;
  const allInstalledPlugins = await getInstalledPluginsFromRegistry();

  if (!allInstalledPlugins) {
    logger.info(
      'No plugins found. Run "rozenite plugins discover" to discover plugins.'
    );
    return resolvedConfig;
  }

  const approvedPlugins: string[] = [];
  for (const plugin of allInstalledPlugins) {
    if (await isPluginApproved(plugin)) {
      approvedPlugins.push(plugin);
    }
  }

  if (approvedPlugins.length > 0) {
    logger.info(`Loaded ${approvedPlugins.length} approved plugin(s):`);
    approvedPlugins.forEach((plugin) => {
      logger.info(`  - ${plugin}`);
    });
  } else {
    logger.info('No approved plugins found.');
    return resolvedConfig;
  }

  if (allInstalledPlugins.length === 0) {
    logger.info(
      'No plugins found. Run "rozenite plugins discover" to discover plugins.'
    );
    return resolvedConfig;
  }

  patchDevtoolsFrontendUrl();
  getWebSocketBroadcastServer();

  let augmentedConfig: MetroConfig = {
    ...resolvedConfig,
    server: {
      ...resolvedConfig.server,
      enhanceMiddleware: (metroMiddleware, server) => {
        const customMiddleware = getMiddleware(approvedPlugins);
        const prevMiddleware =
          resolvedConfig.server?.enhanceMiddleware?.(metroMiddleware, server) ??
          metroMiddleware;

        return customMiddleware.use(prevMiddleware);
      },
    },
  };

  for (const plugin of approvedPlugins) {
    const backgroundScript = tryResolve(`${plugin}/background.js`);

    if (!backgroundScript) {
      continue;
    }

    logger.info(`Applying background config for plugin: ${plugin}`);
    augmentedConfig = backgroundScript(augmentedConfig);
  }

  return augmentedConfig;
};
