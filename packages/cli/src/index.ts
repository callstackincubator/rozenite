import { Command } from 'commander';
import { color } from './utils/color.js';
import { outro } from './utils/prompts.js';
import { getPackageJSON } from './package-json.js';
import { logger } from './utils/logger.js';
import { generateCommand } from './commands/generate/generate-command.js';
import { buildCommand } from './commands/build-command.js';
import { devCommand } from './commands/dev-command.js';
import { initCommand } from './commands/init-command.js';
import { registerMCPCommand } from './commands/mcp/register-mcp-command.js';

const packageJSON = getPackageJSON();

const isJsonMode = (argv: string[]): boolean => {
  return argv.includes('--json');
};

const isPrettyJsonMode = (argv: string[]): boolean => {
  return argv.includes('--pretty');
};

const writeJsonError = (error: unknown, pretty: boolean): void => {
  const message = error instanceof Error ? error.message : String(error);
  const payload = {
    error: {
      message,
    },
  };

  process.stdout.write(`${JSON.stringify(payload, null, pretty ? 2 : 0)}\n`);
};

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

  program
    .command('init')
    .alias('i')
    .description('Initialize Rozenite in an existing project')
    .arguments('[path]')
    .usage(`[options] ${color.green('[path]')}`)
    .action(async (path) => {
      const targetDir = path ?? process.cwd();
      await initCommand(targetDir);
    });

  registerMCPCommand(program);

  await program.parseAsync(process.argv);
};

main().catch((error) => {
  if (isJsonMode(process.argv)) {
    writeJsonError(error, isPrettyJsonMode(process.argv));
    process.exit(1);
  }

  logger.error('Command failed');
  logger.error('Error details:', error);
  outro(
    `If you think this is a bug, please report it at ${packageJSON.bugs.url}`
  );
  process.exit(1);
});
