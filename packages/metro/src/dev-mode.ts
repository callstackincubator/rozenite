import { MetroConfig } from 'metro-config';
import path from 'node:path';
import { logger } from './logger.js';
import { RozeniteMetroConfig } from './config.js';

export const enableDevModeIfNeeded = (
  options: RozeniteMetroConfig,
  config: MetroConfig
): void => {
  const packageName = process.env.ROZENITE_DEV_MODE;

  if (!packageName) {
    return;
  }

  logger.info(`Dev mode is enabled for package: ${packageName}`);

  const packagePath = path.dirname(require.resolve(packageName));

  options.exclude = [...(options.exclude ?? []), packageName];
  config.watchFolders = [...(config.watchFolders ?? []), packagePath];
};
