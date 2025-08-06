import fs from 'node:fs';
import path from 'node:path';
import semver from 'semver';
import { logger } from './logger.js';
import { getReactNativePackagePath } from './resolve.js';

const REQUIRED_REACT_NATIVE_VERSION = '0.76.0';

export const verifyReactNativeVersion = (projectRoot: string): void => {
  const reactNativePath = getReactNativePackagePath(projectRoot);
  const packageJsonPath = path.join(reactNativePath, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const reactNativeVersion = packageJson.version;

  if (
    semver.satisfies(reactNativeVersion, `>=${REQUIRED_REACT_NATIVE_VERSION}`)
  ) {
    return;
  }

  logger.error(
    `React Native DevTools requires React Native ${REQUIRED_REACT_NATIVE_VERSION} or higher.\n` +
      `   Current version: ${reactNativeVersion}\n` +
      `   Please upgrade your React Native version to continue using Rozenite.`
  );
  process.exit(1);
};
