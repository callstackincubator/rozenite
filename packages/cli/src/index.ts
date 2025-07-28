import { Command } from 'commander';
import { color } from './utils/color.js';
import { outro } from './utils/prompts.js';
import { getPackageJSON } from './package-json.js';
import { logger } from './utils/logger.js';
import { generateCommand } from './commands/generate/generate-command.js';
import { buildCommand } from './commands/build-command.js';
import { devCommand } from './commands/dev-command.js';

const packageJSON = getPackageJSON();

const main = async () => {
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

  program
    .command('dev')
    .alias('d')
    .description('Start development server with watchers')
    .arguments('[path]')
    .usage(`[options] ${color.green('[path]')}`)
    .action(async (path) => {
      const targetDir = path ?? process.cwd();
      await devCommand(targetDir);
    });

  program.parse(process.argv);
};

main().catch((error) => {
  logger.error('Command failed');
  logger.error('Error details:', error);
  outro(
    `If you think this is a bug, please report it at ${packageJSON.bugs.url}`
  );
  process.exit(1);
});
