import { spawn } from './spawn.js';

const getPackageManager = (): string => {
  const packageManager = process.env.npm_config_user_agent;

  if (packageManager?.startsWith('pnpm')) {
    return 'pnpm';
  }

  if (packageManager?.startsWith('yarn')) {
    return 'yarn';
  }

  if (packageManager?.startsWith('bun')) {
    return 'bun';
  }

  return 'npm';
};

export const installDependencies = async (
  projectRoot: string
): Promise<void> => {
  const packageManager = getPackageManager();
  await spawn(packageManager, ['install'], { cwd: projectRoot });
};
