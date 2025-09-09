import { spawn } from './spawn.js';

export const isGitRepositoryClean = async (
  projectRoot: string
): Promise<boolean> => {
  try {
    const process = await spawn('git', ['status', '--porcelain'], {
      cwd: projectRoot,
    });

    // No output = no changes
    return process.output.trim().length === 0;
  } catch {
    return false;
  }
};
