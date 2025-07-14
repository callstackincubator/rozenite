import { updatePluginRegistry } from '../../plugin-registry.js';
import { intro, outro } from '../../utils/prompts.js';
import { logger } from '../../utils/logger.js';
import { color } from '../../utils/color.js';

export const discoverPlugins = async (): Promise<void> => {
  intro('Discovering React Native DevTools plugins...');

  try {
    const registry = await updatePluginRegistry();

    logger.info(`Found ${registry.plugins.length} plugin(s) in node_modules:`);

    if (registry.plugins.length === 0) {
      logger.info(
        'No plugins found. Install some React Native DevTools plugins to get started.'
      );
    } else {
      registry.plugins.forEach((plugin, index) => {
        logger.info(`\n${index + 1}. ${color.cyan(plugin.id)}`);
        logger.info(`   ID: ${plugin.id}`);

        // TODO: FIX
        // if (plugin.manifest.description) {
        //   logger.info(`   Description: ${plugin.manifest.description}`);
        // }

        // if (plugin.manifest.version) {
        //   logger.info(`   Version: ${plugin.manifest.version}`);
        // }

        // if (plugin.manifest.author) {
        //   logger.info(`   Author: ${plugin.manifest.author}`);
        // }
      });
    }

    logger.info(`\nPlugin registry updated at: ${registry.lastUpdated}`);
    logger.info('Run "rozenite plugins approve" to approve plugins for use.');
  } catch (error) {
    logger.error('Failed to discover plugins:', error);
  }

  outro();
};
