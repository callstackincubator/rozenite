import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

export const getReactNativePackagePath = (projectRoot: string): string => {
  const input = require.resolve('react-native', { paths: [projectRoot] });
  return path.dirname(input);
};

export const getExpoPackagePath = (projectRoot: string): string | null => {
  try {
    const input = require.resolve('expo', { paths: [projectRoot] });
    return path.dirname(input);
  } catch (error) {
    // Check if error is due to non-existing package
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'MODULE_NOT_FOUND'
    ) {
      return null;
    }

    throw error;
  }
};

const getDevMiddlewarePathFromExpo = (projectRoot: string): string | null => {
  const expoPackagePath = getExpoPackagePath(projectRoot);

  if (!expoPackagePath) {
    return null;
  }

  const expoCliPath = require.resolve('@expo/cli', {
    paths: [expoPackagePath],
  });

  return require.resolve('@react-native/dev-middleware', {
    paths: [expoCliPath],
  });
};

const getDevMiddlewarePathFromReactNative = (projectRoot: string): string => {
  const reactNativePackagePath = getReactNativePackagePath(projectRoot);

  const reactNativeCommunityCliPluginPath = require.resolve(
    '@react-native/community-cli-plugin',
    { paths: [reactNativePackagePath] }
  );

  return require.resolve('@react-native/dev-middleware', {
    paths: [reactNativeCommunityCliPluginPath],
  });
};

export const getDevMiddlewarePath = (projectRoot: string): string => {
  // If this is an Expo project, we need to resolve the dev middleware from the Expo package.
  return (
    getDevMiddlewarePathFromExpo(projectRoot) ??
    getDevMiddlewarePathFromReactNative(projectRoot)
  );
};
