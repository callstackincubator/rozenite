import path from 'node:path';
import fs from 'node:fs';
import { spawn } from './spawn.js';

const getPackageManagerByLockfile = (projectRoot: string): string | null => {
  // Check for lockfiles in order of preference
  const lockfiles: Array<[string, string]> = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lockb', 'bun'],
    ['bun.lock', 'bun'],
    ['package-lock.json', 'npm'],
  ];

  for (const [lockfile, manager] of lockfiles) {
    if (fs.existsSync(path.join(projectRoot, lockfile))) {
      return manager;
    }
  }

  return null;
};

const getPackageManagerByEnv = (): string => {
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

const getPackageManager = (projectRoot?: string): string => {
  if (projectRoot) {
    const lockfileManager = getPackageManagerByLockfile(projectRoot);
    if (lockfileManager) {
      return lockfileManager;
    }
  }

  return getPackageManagerByEnv();
};

export const getExecForPackageManager = (projectRoot?: string): string => {
  const packageManager = getPackageManager(projectRoot);

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
  projectRoot: string,
): Promise<void> => {
  const packageManager = getPackageManager(projectRoot);
  await spawn(packageManager, ['install'], { cwd: projectRoot });
};

export const installDevDependency = async (
  projectRoot: string,
  packageName: string,
): Promise<void> => {
  const packageManager = getPackageManager(projectRoot);
  const args = ['add', '-D', packageName];
  await spawn(packageManager, args, { cwd: projectRoot });
};

export const isPackageInstalled = async (
  projectRoot: string,
  packageName: string,
): Promise<boolean> => {
  const packageManager = getPackageManager(projectRoot);
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
