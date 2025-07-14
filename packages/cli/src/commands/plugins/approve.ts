import { InstalledPlugin } from '../../types.js';
import { addApprovedPlugin, getNewPlugins } from '../../plugin-cache.js';
import { getPluginRegistry } from '../../plugin-registry.js';
import {
  showPluginApprovalPrompt,
  showBatchApprovalPrompt,
  isNonInteractive,
} from './helpers.js';
import { intro, outro } from '../../utils/prompts.js';
import { step } from '../../utils/steps.js';
import { logger } from '../../utils/logger.js';

export const approvePlugins = async (): Promise<void> => {
  intro('Rozenite');

  await step(
    {
      start: 'Discovering plugins',
      stop: 'Plugins discovered',
      error: 'Failed to discover plugins',
    },
    async () => {
      const registry = await getPluginRegistry();
      const allPlugins = registry.plugins;
      const newPlugins = await getNewPlugins(allPlugins);

      if (newPlugins.length === 0) {
        logger.info('No new plugins to approve');
        outro();
        return;
      }

      // Check if we're in a non-interactive environment
      if (isNonInteractive()) {
        logger.warn('Non-interactive environment detected');
        logger.info('Skipping plugin approval prompts');
        logger.info(
          'To approve plugins, run in an interactive terminal or set ROZENITE_AUTO_APPROVE=true'
        );

        // Auto-approve if explicitly set
        if (process.env.ROZENITE_AUTO_APPROVE === 'true') {
          logger.info(
            'Auto-approving all plugins due to ROZENITE_AUTO_APPROVE=true'
          );

          await step(
            {
              start: 'Approving plugins',
              stop: 'All plugins approved',
              error: 'Failed to approve plugins',
            },
            async () => {
              for (const plugin of newPlugins) {
                await addApprovedPlugin(plugin.id);
              }
            }
          );

          outro();
          return;
        }

        outro();
        return;
      }

      logger.info('Plugins need approval before they can be loaded');

      const approvedPlugins: InstalledPlugin[] = [];

      if (newPlugins.length === 1) {
        // Single plugin approval
        const plugin = newPlugins[0];
        const approved = await showPluginApprovalPrompt(plugin);

        if (approved) {
          await step(
            {
              start: `Approving plugin "${plugin.id}"`,
              stop: `Plugin "${plugin.id}" approved`,
              error: `Failed to approve plugin "${plugin.id}"`,
            },
            async () => {
              await addApprovedPlugin(plugin.id);
            }
          );
          approvedPlugins.push(plugin);
        } else {
          logger.info(`Plugin "${plugin.id}" skipped`);
        }
      } else {
        // Batch approval
        const selectedPluginIds = await showBatchApprovalPrompt(newPlugins);

        if (selectedPluginIds.length > 0) {
          await step(
            {
              start: 'Approving selected plugins',
              stop: 'Selected plugins approved',
              error: 'Failed to approve plugins',
            },
            async () => {
              for (const pluginId of selectedPluginIds) {
                const plugin = newPlugins.find((p) => p.id === pluginId);
                if (plugin) {
                  await addApprovedPlugin(plugin.id);
                  approvedPlugins.push(plugin);
                }
              }
            }
          );
        }

        const skippedCount = newPlugins.length - selectedPluginIds.length;
        if (skippedCount > 0) {
          logger.info(`${skippedCount} plugin(s) skipped`);
        }
      }

      logger.info(
        'Plugin approval information is saved in node_modules/.cache/rozenite/'
      );

      if (approvedPlugins.length > 0) {
        outro();
      } else {
        outro();
      }
    }
  );
};
