import path from 'node:path';
import fs from 'node:fs';

const MODULE_EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.cts', '.mts'];
const METRO_CONFIG_FILE = 'metro.config.js';
const REPACK_CONFIG_FILE = 'rspack.config.js';

export type ProjectType = 'react-native-cli' | 'expo';
export type BundlerType = 'metro' | 'repack';

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

const isSourceFilePresent = (
  projectRoot: string,
  fileName: string
): boolean => {
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

export const getBundlerType = (projectRoot: string): BundlerType => {
  if (isSourceFilePresent(projectRoot, METRO_CONFIG_FILE)) {
    return 'metro';
  }

  if (isSourceFilePresent(projectRoot, REPACK_CONFIG_FILE)) {
    return 'repack';
  }

  throw new UnknownBundlerType(projectRoot);
};
