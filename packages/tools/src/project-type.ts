import fs from 'node:fs';
import path from 'node:path';

const MODULE_EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.cts', '.mts'];
const METRO_CONFIG_FILE = 'metro.config.js';
const REPACK_CONFIG_FILE = 'rspack.config.js';
const LYNX_CONFIG_FILE = 'lynx.config.js';
const LYNX_RSPEEDY_PACKAGE = '@lynx-js/rspeedy';

export type ProjectType = 'react-native-cli' | 'expo';
export type BundlerType = 'metro' | 'repack' | 'lynx';

const isExpoProject = (projectRoot: string): boolean => {
  const appJsonPath = path.join(projectRoot, 'app.json');

  if (!fs.existsSync(appJsonPath)) {
    return false;
  }

  try {
    const appJsonContent = fs.readFileSync(appJsonPath, 'utf8');
    const appJson = JSON.parse(appJsonContent);
    return typeof appJson === 'object' && appJson !== null && 'expo' in appJson;
  } catch {
    // If we can't parse the JSON, it's not a valid Expo project
    return false;
  }
};

const hasDependency = (projectRoot: string, packageName: string): boolean => {
  const packageJsonPath = path.join(projectRoot, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);
    return Boolean(
      packageJson?.dependencies?.[packageName] || packageJson?.devDependencies?.[packageName],
    );
  } catch {
    // If we can't parse the JSON, we can't tell.
    return false;
  }
};

const isSourceFilePresent = (projectRoot: string, fileName: string): boolean => {
  const name = fileName.split('.').slice(0, -1).join('.');

  for (const extension of MODULE_EXTENSIONS) {
    if (fs.existsSync(path.join(projectRoot, name + extension))) {
      return true;
    }
  }

  return false;
};

export class UnknownProjectType extends Error {
  constructor(projectRoot: string) {
    super(`Could not determine project type for ${projectRoot}`);
  }
}

export class UnknownBundlerType extends Error {
  constructor(projectRoot: string) {
    super(`Could not determine bundler type for ${projectRoot}`);
  }
}

export const getProjectType = (projectRoot: string): ProjectType => {
  if (isExpoProject(projectRoot)) {
    return 'expo';
  }

  // We fallback to React Native CLI if we can't determine the project type.
  return 'react-native-cli';
};

export const getAvailableBundlerTypes = (projectRoot: string): BundlerType[] => {
  const bundlers: BundlerType[] = [];

  if (isSourceFilePresent(projectRoot, METRO_CONFIG_FILE)) {
    bundlers.push('metro');
  }

  if (isSourceFilePresent(projectRoot, REPACK_CONFIG_FILE)) {
    bundlers.push('repack');
  }

  if (
    isSourceFilePresent(projectRoot, LYNX_CONFIG_FILE) ||
    hasDependency(projectRoot, LYNX_RSPEEDY_PACKAGE)
  ) {
    bundlers.push('lynx');
  }

  return bundlers;
};
