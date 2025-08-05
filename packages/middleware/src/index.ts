import { type Application } from 'express';
import { patchDevtoolsFrontendUrl } from './dev-tools-url-patch.js';
import { getMiddleware } from './middleware.js';
import { logger } from './logger.js';
import { getInstalledPlugins } from './auto-discovery.js';
import type { RozeniteConfig } from './config.js';
import { getDevModePackage } from './dev-mode.js';
import { verifyReactNativeVersion } from './verify-react-native-version.js';
import { getDevMiddlewarePath, getReactNativePackagePath } from './resolve.js';

export type RozeniteMiddleware = Application;
export type RozeniteInstance = {
  middleware: RozeniteMiddleware;
  devModePackage: { name: string; path: string } | null;
};

export const initializeRozenite = (
  options: RozeniteConfig
): RozeniteInstance => {
  verifyReactNativeVersion(options.projectRoot);

  if (process.env.ROZENITE_DEBUG === 'true') {
    logger.debug('Rozenite is running in debug mode.');
    logger.debug(`Resolution root: ${options.projectRoot}`);
    logger.debug(
      `Resolved react-native to: ${getReactNativePackagePath(
        options.projectRoot
      )}`
    );
    logger.debug(
      `Resolved @react-native/dev-middleware to: ${getDevMiddlewarePath(
        options.projectRoot
      )}`
    );
  }

  const devModePackage = getDevModePackage(options.projectRoot);

  if (devModePackage) {
    options.exclude = [...(options.exclude ?? []), devModePackage.name];
    logger.info(`Dev mode is enabled for package: ${devModePackage.name}`);
  }

  const allInstalledPlugins = getInstalledPlugins(options);

  if (allInstalledPlugins.length === 0) {
    logger.info('No plugins found.');
  } else {
    logger.info(`Loaded ${allInstalledPlugins.length} plugin(s):`);
    allInstalledPlugins.forEach((plugin) => {
      logger.info(`  - ${plugin.name}`);
    });
  }

  patchDevtoolsFrontendUrl(options.projectRoot);

  return {
    middleware: getMiddleware(
      allInstalledPlugins,
      options.destroyOnDetachPlugins || []
    ),
    devModePackage,
  };
};

export type { RozeniteConfig };
