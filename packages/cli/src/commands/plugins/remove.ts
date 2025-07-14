import {
  getApprovedPlugins,
  removeApprovedPlugin,
} from '../../plugin-cache.js';
import { getInstalledPlugins } from '../../auto-discovery.js';
import { getNodeModulesPaths } from '../../node-modules-paths.js';
import {
  intro,
  outro,
  promptSelect,
  promptConfirm,
} from '../../utils/prompts.js';
import { step } from '../../utils/steps.js';
import { logger } from '../../utils/logger.js';

export const removePluginApproval = async (): Promise<void> => {
  intro('Rozenite');

  await step(
    {
      start: 'Loading approved plugins',
      stop: 'Approved plugins loaded',
      error: 'Failed to load approved plugins',
    },
    async () => {
      const approvedPlugins = await getApprovedPlugins();

      if (approvedPlugins.length === 0) {
        logger.info('No plugins are currently approved');
        outro('No plugins to remove');
        return;
      }

      // Get all installed plugins to show details in the selection
      const nodeModulesPaths = getNodeModulesPaths();
      const allPlugins = await getInstalledPlugins(nodeModulesPaths);

      const choices = approvedPlugins.map((pluginId) => {
        const plugin = allPlugins.find((p) => p.id === pluginId);
        if (plugin) {
          return {
            label: plugin.id,
            value: pluginId,
          };
        }
        return {
          label: pluginId,
          value: pluginId,
        };
      });

      const pluginToRemove = await promptSelect({
        message: 'Select a plugin to remove approval:',
        options: choices,
      });

      const confirm = await promptConfirm({
        message: `Are you sure you want to remove approval for "${pluginToRemove}"?`,
        confirmLabel: 'Remove',
        cancelLabel: 'Cancel',
      });

      if (confirm) {
        await step(
          {
            start: `Removing approval for "${pluginToRemove}"`,
            stop: `Approval removed for "${pluginToRemove}"`,
            error: `Failed to remove approval for "${pluginToRemove}"`,
          },
          async () => {
            await removeApprovedPlugin(pluginToRemove);
          }
        );
        outro();
      } else {
        logger.info('Operation cancelled');
        outro('Operation cancelled');
      }
    }
  );
};
