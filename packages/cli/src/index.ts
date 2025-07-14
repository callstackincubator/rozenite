#!/usr/bin/env node

import { Command } from 'commander';
import { color } from './utils/color.js';
import { outro } from './utils/prompts.js';
import { getPackageJSON } from './package-json.js';
import { logger } from './utils/logger.js';
import { generateCommand } from './commands/generate/generate-command.js';
import { buildCommand } from './commands/build-command.js';
import { approvePlugins } from './commands/plugins/approve.js';
import { listApprovedPlugins } from './commands/plugins/list.js';
import { removePluginApproval } from './commands/plugins/remove.js';
import { clearAllApprovals } from './commands/plugins/clear.js';
import { showAvailablePlugins } from './commands/plugins/status.js';
import { discoverPlugins } from './commands/plugins/discover.js';

const main = async () => {
  const packageJSON = await getPackageJSON();
  const program = new Command(packageJSON.name)
    .version(packageJSON.version)
    .description('Create and build React Native DevTools plugins');

  program
    .command('generate')
    .alias('g')
    .description('Generate a new React Native DevTools plugin')
    .arguments('[path]')
    .usage(`[options] ${color.green('[path]')}`)
    .action(async (path) => {
      const targetDir = path ?? process.cwd();
      await generateCommand(targetDir);
    });

  program
    .command('build')
    .alias('b')
    .description('Build a React Native DevTools plugin')
    .arguments('[path]')
    .usage(`[options] ${color.green('[path]')}`)
    .action(async (path) => {
      const targetDir = path ?? process.cwd();
      await buildCommand(targetDir);
    });

  const plugins = program
    .command('plugins')
    .alias('pl')
    .description('Manage React Native DevTools plugins');

  plugins
    .command('approve')
    .alias('a')
    .description('Approve React Native DevTools plugins')
    .action(async () => {
      await approvePlugins();
    });

  plugins
    .command('list')
    .alias('l')
    .description('List approved plugins')
    .action(async () => {
      await listApprovedPlugins();
    });

  plugins
    .command('remove')
    .alias('r')
    .description('Remove approval for a plugin')
    .action(async () => {
      await removePluginApproval();
    });

  plugins
    .command('clear')
    .alias('c')
    .description('Clear all plugin approvals')
    .action(async () => {
      await clearAllApprovals();
    });

  plugins
    .command('status')
    .alias('s')
    .description('Show plugin status and available plugins')
    .action(async () => {
      await showAvailablePlugins();
    });

  plugins
    .command('discover')
    .alias('d')
    .description('Discover and update plugin registry')
    .action(async () => {
      await discoverPlugins();
    });

  program.parse(process.argv);
};

main().catch((error) => {
  logger.error('Command failed');
  logger.error('Error details:', error);
  outro(
    'If you think this is a bug, please report it at https://github.com/XYZ'
  );
  process.exit(1);
});
