import path from 'node:path';
import fs from 'node:fs';
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

export const getExecForPackageManager = (): string => {
  const packageManager = getPackageManager();

  if (packageManager === 'pnpm') {
    return 'pnpx';
  } else if (packageManager === 'yarn') {
    return 'yarn dlx';
  } else if (packageManager === 'bun') {
    return 'bunx';
  }

  return 'npx';
};

export const installDependencies = async (
  projectRoot: string
): Promise<void> => {
  const packageManager = getPackageManager();
  await spawn(packageManager, ['install'], { cwd: projectRoot });
};

export const installDevDependency = async (
  projectRoot: string,
  packageName: string
): Promise<void> => {
  const packageManager = getPackageManager();
  const args = ['add', '-D', packageName];
  await spawn(packageManager, args, { cwd: projectRoot });
};

export const isPackageInstalled = async (
  projectRoot: string,
  packageName: string
): Promise<boolean> => {
  const packageManager = getPackageManager();
  const args = ['list', '--depth=0', '--json'];
  const process = await spawn(packageManager, args, { cwd: projectRoot });
  const output = process.output;
  return output.includes(packageName);
};

export const isProject = (projectRoot: string): boolean => {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  return (
    fs.existsSync(packageJsonPath) &&
    fs.readFileSync(packageJsonPath, 'utf8').includes('react-native')
  );
};
