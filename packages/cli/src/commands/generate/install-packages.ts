import { step } from '../../utils/steps.js';
import { installDependencies } from '../../utils/packages.js';

export const installPackages = async (projectRoot: string): Promise<void> => {
  await step(
    {
      start: 'Installing packages',
      stop: 'Packages installed successfully',
      error: 'Failed to install packages',
    },
    async () => {
      await installDependencies(projectRoot);
    }
  );
};
