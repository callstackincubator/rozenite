import { getApprovedPlugins, getNewPlugins } from '../../plugin-cache.js';
import { getPluginRegistry } from '../../plugin-registry.js';
import { intro, outro } from '../../utils/prompts.js';
import { step } from '../../utils/steps.js';
import { logger } from '../../utils/logger.js';
import { color } from '../../utils/color.js';

export const showAvailablePlugins = async (): Promise<void> => {
  intro('Rozenite');

  await step(
    {
      start: 'Checking plugin status',
      stop: 'Plugin status checked',
      error: 'Failed to check plugin status',
    },
    async () => {
      const registry = await getPluginRegistry();
      const allPlugins = registry.plugins;
      const approvedPluginIds = await getApprovedPlugins();
      const newPlugins = await getNewPlugins(allPlugins);

      if (allPlugins.length === 0) {
        logger.info('No plugins found in node_modules');
        return;
      }

      logger.success(`${approvedPluginIds.length} approved plugin(s)`);

      if (newPlugins.length > 0) {
        logger.warn(`${newPlugins.length} plugin(s) available for approval`);
        logger.info('To approve plugins, run:');
        logger.info(color.cyan('  rozenite plugins approve'));
      }
    }
  );

  outro();
};
