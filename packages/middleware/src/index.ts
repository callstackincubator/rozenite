import { type Application } from 'express';
import {
  createReactNativeIntegration,
  type RozeniteIntegrationProvider,
} from '@rozenite/integration';
import { getMiddleware } from './middleware.js';
import { logger } from './logger.js';
import { getPackageJSON } from './package-json.js';
import { getInstalledPlugins } from './auto-discovery.js';
import { createScopedMiddleware } from './scoped-middleware.js';
import type { RozeniteConfig, RozenitePluginDisplay } from './config.js';
import { getDevModePackage } from './dev-mode.js';
import { createAgentSessionManager } from './agent/index.js';

export type RozeniteMiddleware = Application;
export type RozeniteInstance = {
  middleware: RozeniteMiddleware;
  devModePackage: { name: string; path: string } | null;
  dispose: () => Promise<void>;
};

export { createScopedMiddleware };
export type { MiddlewareHandler, MiddlewareNext, MiddlewareRequest } from './scoped-middleware.js';

/**
 * `RozeniteConfig` plus the one thing that isn't a plain config value: which
 * host this dev server serves. It used to be a `RozeniteHostIntegration`
 * string the middleware branched on internally (`isLynx = integration ===
 * 'lynx'`, repeated at every point React Native and Lynx differ); now it's
 * the implementation itself, so there is nothing left to branch on here.
 * Kept out of `RozeniteConfig` (rather than folded into it) because it is
 * not a value a plugin manifest or `RozeniteAppConfigResponse` ever needs to
 * round-trip - only `integration.id` does.
 */
export type InitializeRozeniteOptions = RozeniteConfig & {
  /**
   * Which host this dev server serves.
   *
   * @default `createReactNativeIntegration({ projectRoot, projectType })` -
   * so `@rozenite/metro` and `@rozenite/repack` need no changes to keep
   * serving React Native. `@rozenite/lynx-dev` passes its own Lynx
   * implementation instead.
   */
  integration?: RozeniteIntegrationProvider;
};

export const initializeRozenite = async (
  options: InitializeRozeniteOptions,
  runtimeVersion?: string,
): Promise<RozeniteInstance> => {
  options.logLevel = process.env.ROZENITE_DEBUG === 'true' ? 'debug' : (options.logLevel ?? 'info');
  logger.setLevel(options.logLevel);

  const integration =
    options.integration ??
    createReactNativeIntegration({
      projectRoot: options.projectRoot,
      projectType: options.projectType,
      logLevel: options.logLevel,
    });

  integration.verifyEnvironment();

  logger.debug('Rozenite is running in debug mode.');
  logger.debug(`Resolution root: ${options.projectRoot}`);

  const devModePackage = getDevModePackage(options.projectRoot);

  if (devModePackage) {
    options.exclude = [...(options.exclude ?? []), devModePackage.name];
    logger.info(`Dev mode is enabled for package: ${devModePackage.name}`);
  }

  const allInstalledPlugins = await getInstalledPlugins(options);
  const agentSessionManager = createAgentSessionManager({
    projectRoot: options.projectRoot,
    metroVersion: getPackageJSON().version,
  });

  if (allInstalledPlugins.length === 0) {
    logger.info('No plugins found.');
  } else {
    logger.info(`Loaded ${allInstalledPlugins.length} plugin(s):`);
    allInstalledPlugins.forEach((plugin) => {
      logger.info(`  - ${plugin.name}`);
    });
  }

  integration.installInspectorHooks();

  return {
    middleware: getMiddleware(
      options,
      integration,
      allInstalledPlugins,
      options.destroyOnDetachPlugins || [],
      agentSessionManager,
      runtimeVersion,
    ),
    devModePackage,
    dispose: async () => {
      await agentSessionManager.dispose();
    },
  };
};

export type { RozeniteConfig, RozenitePluginDisplay };
