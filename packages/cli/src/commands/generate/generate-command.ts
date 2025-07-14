import path from 'node:path';
import { createProjectDirectory } from './create-directory.js';
import { createGitRepository } from './git-init.js';
import { bootstrapPlugin } from './bootstrap-plugin.js';
import { installPackages } from './install-packages.js';
import { fileExists } from '../../utils/files.js';
import { logger } from '../../utils/logger.js';
import { intro, outro } from '../../utils/prompts.js';
import { promptForPluginInfo } from './prompt-for-plugin-info.js';
import { color } from '../../utils/color.js';

export const generateCommand = async (targetDir: string) => {
  intro('Rozenite');

  const pluginInfo = await promptForPluginInfo();
  const projectRoot = path.resolve(targetDir, pluginInfo.name);

  const projectExists = await fileExists(projectRoot);

  if (projectExists) {
    logger.error(`Directory ${projectRoot} already exists`);
    logger.info(
      'Please choose a different name or remove the existing directory'
    );
    process.exit(1);
  }

  await createProjectDirectory(projectRoot);
  await bootstrapPlugin(projectRoot, pluginInfo);
  await installPackages(projectRoot);
  await createGitRepository(projectRoot);

  logger.success(`Plugin created successfully in ${color.green(projectRoot)}`);
  outro(`Happy hacking!`);
};
