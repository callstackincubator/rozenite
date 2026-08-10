import { Command } from 'commander';
import { SkillsRegistry } from '../skills/registry.js';
import { logger } from '../utils/logger.js';

export const registerSkillsCommand = (program: Command): void => {
  const skillsCommand = program
    .command('skills')
    .description('Inspect bundled Rozenite for Agents skill docs');

  skillsCommand
    .command('list')
    .alias('ls')
    .description('List bundled skill docs (id and description)')
    .option('--pretty', 'Pretty-print JSON output')
    .action((options: { pretty?: boolean }) => {
      const registry = new SkillsRegistry();
      const docs = registry.list();
      const payload = docs.map((doc) => ({
        id: doc.id,
        description: doc.description,
        ...(doc.domain ? { domain: doc.domain } : {}),
      }));

      const json = options.pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
      process.stdout.write(`${json}\n`);
    });

  skillsCommand
    .command('show')
    .description('Print a bundled skill doc to stdout')
    .argument('<id>', 'Doc id, e.g. core, cli, sdk, or a domain token like storage')
    .action((id: string) => {
      const registry = new SkillsRegistry();
      const doc = registry.get(id);

      if (!doc) {
        const validIds = registry
          .list()
          .map((entry) => entry.id)
          .join(', ');
        logger.error(`Unknown skill doc "${id}". Valid ids: ${validIds}`);
        process.exitCode = 1;
        return;
      }

      process.stdout.write(`${doc.body}\n`);
    });
};
