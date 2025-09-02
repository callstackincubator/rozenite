import {
  getProjectType,
  type BundlerType
} from '@rozenite/tools';
import { getAvailableBundlerTypes } from '@rozenite/tools';
import { wrapConfigFile } from '../utils/config-wrapper.js';
import { isGitRepositoryClean } from '../utils/git.js';
import { logger } from '../utils/logger.js';
import {
  getExecForPackageManager,
  installDevDependency,
  isProject,
} from '../utils/packages.js';
import { intro, outro, promptConfirm } from '../utils/prompts.js';
import { spawn } from '../utils/spawn.js';
import { step } from '../utils/steps.js';

const formatBundlerType = (bundlerType: BundlerType): string => {
  return bundlerType === 'metro' ? 'Metro' : 'Re.Pack';
};

export const initCommand = async (projectRoot: string) => {
  intro('Rozenite');

  if (!isProject(projectRoot)) {
    logger.error("I couldn't find a React Native project in this directory.");
    return;
  }

  const projectType = getProjectType(projectRoot);
  const bundlerTypes = getAvailableBundlerTypes(projectRoot);
  const isClean = await isGitRepositoryClean(projectRoot);

  // Check if project has uncommitted changes
  if (!isClean) {
    await promptConfirm({
      message: 'Your project has uncommitted changes. Continue?',
    });
  }

  // Create Metro configuration for Expo projects
  if (projectType === 'expo' && !bundlerTypes.length) {
    await step(
      {
        start: 'Creating Metro configuration for Expo project...',
        stop: 'Metro configuration created',
        error: 'Failed to create Metro configuration',
      },
      async () => {
        await spawn(
          getExecForPackageManager(),
          ['expo', 'customize', 'metro.config.js'],
          {
            cwd: projectRoot,
          }
        );
      }
    );
    bundlerTypes.push('metro');
  }

  if (!bundlerTypes.length) {
    throw new Error(
      'Could not determine bundler type. Please ensure you have a metro.config.js or rspack.config.js file.'
    );
  }

  for (const bundlerType of bundlerTypes) {
    // Install the appropriate Rozenite package
    const packageName =
      bundlerType === 'metro' ? '@rozenite/metro' : '@rozenite/repack';

    await step(
      {
        start: `Installing ${packageName}...`,
        stop: `${packageName} installed`,
        error: `Failed to install ${packageName}`,
      },
      async () => {
        await installDevDependency(projectRoot, packageName);
      }
    );

    // Wrap the configuration file
    const formattedBundlerType = formatBundlerType(bundlerType);
    await step(
      {
        start: `Configuring ${formattedBundlerType} to use Rozenite...`,
        stop: `${formattedBundlerType} configuration updated`,
        error: `Failed to update ${formattedBundlerType} configuration`,
      },
      async () => {
        await wrapConfigFile(projectRoot, bundlerType);
      }
    );
  }

  outro('You are now ready to use Rozenite!');
};
