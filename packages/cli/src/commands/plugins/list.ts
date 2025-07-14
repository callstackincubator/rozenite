import { getApprovedPlugins } from '../../plugin-cache.js';
import { getPluginRegistry } from '../../plugin-registry.js';
import { intro, outro } from '../../utils/prompts.js';
import { logger } from '../../utils/logger.js';
import { color } from '../../utils/color.js';

export const listApprovedPlugins = async (): Promise<void> => {
  intro('Rozenite');

  const approvedPluginIds = await getApprovedPlugins();
  const registry = await getPluginRegistry();

  if (approvedPluginIds.length === 0) {
    logger.info('No plugins are currently approved');
    outro();
    return;
  }

  logger.info(`Found ${approvedPluginIds.length} approved plugin(s):`);

  approvedPluginIds.forEach((pluginId, index) => {
    const plugin = registry.plugins.find((p) => p.id === pluginId);

    if (plugin) {
      logger.info(`\n${index + 1}. ${color.cyan(plugin.id)}`);
      logger.info(`   ID: ${plugin.id}`);

      // if (plugin.manifest.description) {
      //   logger.info(`   Description: ${plugin.manifest.description}`);
      // }

      // if (plugin.manifest.version) {
      //   logger.info(`   Version: ${plugin.manifest.version}`);
      // }

      // if (plugin.manifest.author) {
      //   logger.info(`   Author: ${plugin.manifest.author}`);
      // }

      // // Show warnings
      // const warnings = [];
      // if (plugin.manifest.background && plugin.manifest.background.scripts) {
      //   warnings.push(color.red('⚠️  Background Scripts'));
      // }
      // if (
      //   plugin.manifest.permissions &&
      //   plugin.manifest.permissions.length > 0
      // ) {
      //   warnings.push(
      //     color.yellow(`Permissions: ${plugin.manifest.permissions.length}`)
      //   );
      // }
      // if (
      //   plugin.manifest.host_permissions &&
      //   plugin.manifest.host_permissions.length > 0
      // ) {
      //   warnings.push(
      //     color.yellow(
      //       `Host Permissions: ${plugin.manifest.host_permissions.length}`
      //     )
      //   );
      // }

      // if (warnings.length > 0) {
      //   logger.warn(`   ${warnings.join(' | ')}`);
      // }
    } else {
      logger.error(`${index + 1}. ${pluginId} (not found)`);
    }
  });

  outro();
};
