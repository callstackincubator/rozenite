import { Command } from 'commander';
import { DEFAULT_AGENT_HOST } from '@rozenite/agent-shared';
import { color } from './utils/color.js';
import { outro } from './utils/prompts.js';
import { getPackageJSON } from './package-json.js';
import { logger } from './utils/logger.js';
import { generateCommand } from './commands/generate/generate-command.js';
import { buildCommand } from './commands/build-command.js';
import { devCommand } from './commands/dev-command.js';
import { initCommand } from './commands/init-command.js';
import { openCommand } from './commands/open-command.js';
import { DEFAULT_DEV_SERVERS } from './commands/dev-servers.js';
import { registerAgentCommand } from './commands/agent/register-agent-command.js';
import { registerSkillsCommand } from './commands/register-skills-command.js';
import { getErrorMessage } from './commands/agent/error-message.js';
import { BuildToolError } from './utils/spawn.js';

const packageJSON = getPackageJSON();

const isJsonMode = (argv: string[]): boolean => {
  return argv.includes('--json');
};

const isAgentMode = (argv: string[]): boolean => {
  return argv.includes('agent');
};

const isPrettyJsonMode = (argv: string[]): boolean => {
  return argv.includes('--pretty');
};

const writeJsonError = (error: unknown, pretty: boolean): void => {
  const payload = {
    error: {
      message: getErrorMessage(error),
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
    .option('-v, --verbose', 'Stream the output of the underlying build tools')
    .usage(`[options] ${color.green('[path]')}`)
    .action(async (path, options) => {
      const targetDir = path ?? process.cwd();
      logger.setVerbose(!!options.verbose);
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

  program
    .command('open')
    .description('Open Rozenite DevTools for a connected device')
    .option('--host <host>', 'Dev server host', DEFAULT_AGENT_HOST)
    .option(
      '--port <port>',
      `Dev server port (default: ${DEFAULT_DEV_SERVERS.map((server) => server.port).join(' and ')}, scanned together)`,
    )
    .option('--deviceId <id>', 'Target device ID (skips the picker)')
    .action(async (options: { host: string; port?: string; deviceId?: string }) => {
      await openCommand({
        host: options.host,
        port: options.port === undefined ? undefined : Number(options.port),
        deviceId: options.deviceId,
      });
    });

  registerAgentCommand(program);
  registerSkillsCommand(program);

  await program.parseAsync(process.argv);
};

main().catch((error) => {
  if (isJsonMode(process.argv) || isAgentMode(process.argv)) {
    writeJsonError(error, isPrettyJsonMode(process.argv));
    process.exit(1);
  }

  // A build tool that exited non-zero has already said what went wrong, and
  // the fault is in the plugin rather than in Rozenite. Print its output as-is
  // instead of burying it under a stack trace and a bug report link.
  if (error instanceof BuildToolError) {
    logger.error(error.message);
    outro('Build failed');
    process.exit(1);
  }

  logger.error('Command failed');
  logger.error('Error details:', error);
  outro(`If you think this is a bug, please report it at ${packageJSON.bugs.url}`);
  process.exit(1);
});
