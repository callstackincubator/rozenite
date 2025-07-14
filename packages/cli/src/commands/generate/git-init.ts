import { step } from '../../utils/steps.js';
import { spawn } from '../../utils/spawn.js';

export const createGitRepository = async (
  projectRoot: string
): Promise<void> => {
  await step(
    {
      start: 'Initializing Git repository',
      stop: 'Git repository initialized successfully',
      error: 'Failed to initialize Git repository',
    },
    async () => {
      await spawn('git', ['init'], { cwd: projectRoot });
      await spawn('git', ['add', '.'], { cwd: projectRoot });
      await spawn('git', ['commit', '-m', 'Initial commit'], {
        cwd: projectRoot,
      });
    }
  );
};
