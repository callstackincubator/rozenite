import { createRequire } from 'node:module';
import path from 'node:path';
import { getProjectType, type ProjectType } from '@rozenite/tools';
import { logger } from '@rozenite/tools';

const require = createRequire(import.meta.url);

/**
 * The subset of `RozeniteConfig` that resolving React Native and
 * `@react-native/dev-middleware` actually needs. Importing the whole config
 * type from `@rozenite/middleware` would be circular - this package is a
 * dependency of the middleware, not the other way around - so callers
 * (`@rozenite/middleware`'s `createReactNativeIntegration` wiring) pass just
 * these two values instead.
 */
export type ProjectResolutionOptions = {
  projectRoot: string;
  projectType?: ProjectType;
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

  const reactNativeCommunityCliPluginPath = require.resolve('@react-native/community-cli-plugin', {
    paths: [reactNativePackagePath],
  });

  return require.resolve('@react-native/dev-middleware', {
    paths: [reactNativeCommunityCliPluginPath],
  });
};

export const getDevMiddlewarePath = (options: ProjectResolutionOptions): string => {
  if (options.projectType) {
    if (options.projectType === 'expo') {
      logger.debug(
        'User declared this is an Expo project, resolving @react-native/dev-middleware from Expo package.',
      );

      const expoDevMiddlewarePath = getDevMiddlewarePathFromExpo(options.projectRoot);

      if (!expoDevMiddlewarePath) {
        throw new Error(
          "User declared this is an Expo project, but @react-native/dev-middleware was not found. Either this is not an Expo project or it's a bug in Rozenite.",
        );
      }

      return expoDevMiddlewarePath;
    }

    if (options.projectType === 'react-native-cli') {
      logger.debug(
        'User declared this is a React Native project, resolving @react-native/dev-middleware from React Native package.',
      );

      return getDevMiddlewarePathFromReactNative(options.projectRoot);
    }

    throw new Error(`Unknown project type: ${options.projectType}.`);
  }

  // This env var is set by Expo when running the dev server
  const hasExpoEnv = !!process.env.EXPO_DEV_SERVER_ORIGIN;
  const projectType = hasExpoEnv ? 'expo' : getProjectType(options.projectRoot);

  if (projectType === 'expo') {
    logger.debug(
      'Guessing that this is an Expo project, resolving @react-native/dev-middleware from Expo package.',
    );

    const expoDevMiddlewarePath = getDevMiddlewarePathFromExpo(options.projectRoot);

    if (!expoDevMiddlewarePath) {
      throw new Error(
        "I guessed that this is an Expo project, but @react-native/dev-middleware was not found. That's unexpected and you should report this as a bug in Rozenite's issue tracker.",
      );
    }

    return expoDevMiddlewarePath;
  }

  logger.debug(
    'This is most likely not an Expo project, resolving @react-native/dev-middleware from React Native package.',
  );

  return getDevMiddlewarePathFromReactNative(options.projectRoot);
};

/**
 * Requires one of `@react-native/dev-middleware`'s own internal modules,
 * by path relative to the package entry point's directory.
 *
 * Both places Rozenite patches that package (`dev-tools-url-patch.ts` and
 * `integration-domain.ts`) need this, and neither can use a plain deep
 * import: the package's `exports` map allows only `.` and
 * `./package.json`, so `@react-native/dev-middleware/dist/...` throws
 * `ERR_PACKAGE_PATH_NOT_EXPORTED`. Resolving the entry and joining the
 * sibling path by hand is the way around that — kept here, in one place,
 * because reaching into another package's internals is the
 * version-sensitive part of both patches and should move as one.
 */
export const requireDevMiddlewareInternal = (
  options: ProjectResolutionOptions,
  relativePath: string,
): Record<string, unknown> => {
  return require(path.join(path.dirname(getDevMiddlewarePath(options)), relativePath));
};

export const getReactNativeDebuggerFrontendPath = (options: ProjectResolutionOptions): string => {
  const devMiddlewarePath = getDevMiddlewarePath(options);

  return require.resolve('@react-native/debugger-frontend', {
    paths: [devMiddlewarePath],
  });
};
