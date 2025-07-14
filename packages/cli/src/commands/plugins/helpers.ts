import { InstalledPlugin } from '../../types.js';
import { promptConfirm, promptMultiselect, note } from '../../utils/prompts.js';
import { logger } from '../../utils/logger.js';
import { color } from '../../utils/color.js';

export const formatPluginInfo = (plugin: InstalledPlugin): string => {
  //const manifest = plugin.manifest;
  let info = '';

  // TODO: FIX
  // Plugin name and ID
  info += `${color.cyan(plugin.id)}\n`;
  info += `${color.dim(`ID: ${plugin.id}`)}\n\n`;

  // // Description
  // if (manifest.description) {
  //   info += `${manifest.description}\n\n`;
  // }

  // // Version
  // if (manifest.version) {
  //   info += `${color.dim(`Version: ${manifest.version}`)}\n`;
  // }

  // // Homepage
  // if (manifest.homepage_url) {
  //   info += `${color.dim(`Homepage: ${manifest.homepage_url}`)}\n`;
  // }

  // // Author
  // if (manifest.author) {
  //   info += `${color.dim(`Author: ${manifest.author}`)}\n`;
  // }

  // // Background scripts - with warning
  // if (manifest.background_script) {
  //   info += `\n${color.red('⚠️  BACKGROUND SCRIPT DETECTED!')}\n`;
  //   info += `${color.red('This plugin contains a background script.')}\n`;
  //   info += `${color.red(
  //     'Background scripts have access to all Node.js APIs.'
  //   )}\n`;
  //   info += `${color.red('Please review carefully before approving.')}\n`;

  //   manifest.background.scripts.forEach((script: string, index: number) => {
  //     info += `${color.red(`  ${index + 1}. ${script}`)}\n`;
  //   });
  // }

  return info;
};

export const formatPluginSummary = (plugin: InstalledPlugin): string => {
  //const manifest = plugin.manifest;
  let summary = `${plugin.id}`;

  // if (manifest.description) {
  //   summary += ` - ${manifest.description}`;
  // }

  // const warnings = [];
  // // if (manifest.background_script) {
  // //   warnings.push('⚠️  Background Script');
  // // }

  // if (warnings.length > 0) {
  //   summary += ` [${warnings.join(' | ')}]`;
  // }

  return summary;
};

export const showPluginApprovalPrompt = async (
  plugin: InstalledPlugin
): Promise<boolean> => {
  logger.info('New plugin discovered!');

  const pluginInfo = formatPluginInfo(plugin);
  note(pluginInfo, 'Plugin Details');

  return await promptConfirm({
    message: 'Would you like to approve this plugin?',
    confirmLabel: 'Approve',
    cancelLabel: 'Skip',
  });
};

export const showBatchApprovalPrompt = async (
  plugins: InstalledPlugin[]
): Promise<string[]> => {
  logger.info(`${plugins.length} new plugin(s) discovered!`);

  // Show detailed information for each plugin
  plugins.forEach((plugin, index) => {
    logger.info(`\n${index + 1}. ${color.cyan(plugin.id)}`);
    logger.info(`   ID: ${plugin.id}`);

    // if (plugin.manifest.description) {
    //   logger.info(`   Description: ${plugin.manifest.description}`);
    // }

    // if (plugin.manifest.version) {
    //   logger.info(`   Version: ${plugin.manifest.version}`);
    // }

    // Show warnings
    // const warnings = [];
    // // TODO: FIX
    // // if (plugin.manifest.background_script) {
    // //   warnings.push(color.red('⚠️  Background Script'));
    // // }

    // if (warnings.length > 0) {
    //   logger.warn(`   ${warnings.join(' | ')}`);
    // }
  });

  const choices = plugins.map((plugin) => ({
    label: formatPluginSummary(plugin),
    value: plugin.id,
  }));

  return await promptMultiselect({
    message: 'Select plugins to approve:',
    options: choices,
  });
};

export const isNonInteractive = (): boolean => {
  return !process.stdin.isTTY || process.env.CI === 'true';
};
