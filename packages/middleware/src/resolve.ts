import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { logger } from './logger.js';
import { RozeniteConfig } from './config.js';

const require = createRequire(import.meta.url);

const doesProjectLookLikeExpo = (projectRoot: string): boolean => {
  if (process.env.EXPO_DEV_SERVER_ORIGIN) {
    return true;
  }

  const appJsonPath = path.join(projectRoot, 'app.json');

  if (fs.existsSync(appJsonPath)) {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

    if (appJson.expo) {
      return true;
    }
  }

  return false;
};

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

export const getDevMiddlewarePath = (options: RozeniteConfig): string => {
  if (options.projectType) {
    if (options.projectType === 'expo') {
      logger.debug(
        'User declared this is an Expo project, resolving @react-native/dev-middleware from Expo package.'
      );

      const expoDevMiddlewarePath = getDevMiddlewarePathFromExpo(
        options.projectRoot
      );

      if (!expoDevMiddlewarePath) {
        throw new Error(
          "User declared this is an Expo project, but @react-native/dev-middleware was not found. Either this is not an Expo project or it's a bug in Rozenite."
        );
      }

      return expoDevMiddlewarePath;
    }

    if (options.projectType === 'react-native-cli') {
      logger.debug(
        'User declared this is a React Native project, resolving @react-native/dev-middleware from React Native package.'
      );

      return getDevMiddlewarePathFromReactNative(options.projectRoot);
    }

    throw new Error(`Unknown project type: ${options.projectType}.`);
  }

  if (doesProjectLookLikeExpo(options.projectRoot)) {
    logger.debug(
      'Guessing that this is an Expo project, resolving @react-native/dev-middleware from Expo package.'
    );

    const expoDevMiddlewarePath = getDevMiddlewarePathFromExpo(
      options.projectRoot
    );

    if (!expoDevMiddlewarePath) {
      throw new Error(
        "I guessed that this is an Expo project, but @react-native/dev-middleware was not found. That's unexpected and you should report this as a bug in Rozenite's issue tracker."
      );
    }

    return expoDevMiddlewarePath;
  }

  logger.debug(
    'This is most likely not an Expo project, resolving @react-native/dev-middleware from React Native package.'
  );

  return getDevMiddlewarePathFromReactNative(options.projectRoot);
};

export const getReactNativeDebuggerFrontendPath = (
  options: RozeniteConfig
): string => {
  const devMiddlewarePath = getDevMiddlewarePath(options);

  return require.resolve('@react-native/debugger-frontend', {
    paths: [devMiddlewarePath],
  });
};
