import { initializeRozenite, RozeniteConfig } from '@rozenite/middleware';
import {
  type RepackRspackConfig,
  type RepackRspackConfigExport,
} from '@callstack/repack';
import { assertSupportedRePackVersion } from './version-check.js';

const patchConfig = (
  config: RepackRspackConfig,
  rozeniteConfig: RozeniteConfig
): RepackRspackConfig => {
  return {
    ...config,
    devServer: {
      ...config.devServer,
      setupMiddlewares: (middlewares) => {
        const { middleware: rozeniteMiddleware } =
          initializeRozenite(rozeniteConfig);
        middlewares.unshift(rozeniteMiddleware);
        return middlewares;
      },
    },
  };
};

export type RozeniteRePackConfig = {
  /**
   * Whether to enable Rozenite.
   * If false, Rozenite will not be initialized and the config will be returned as is.
   * @default false
   */
  enabled?: boolean;
  /**
   * Certain Rozenite plugins require Re.Pack to be configured in a specific way.
   * This option allows you to modify the Re.Pack config in a way that is safe to do when bundling.
   */
  enhanceRePackConfig?: (
    config: RepackRspackConfig
  ) => Promise<RepackRspackConfig> | RepackRspackConfig;
} & Omit<RozeniteConfig, 'projectRoot'>;

export const withRozenite = (
  config: RepackRspackConfigExport,
  rozeniteConfig: RozeniteRePackConfig = {}
): RepackRspackConfigExport => {
  assertSupportedRePackVersion(process.cwd());

  if (!rozeniteConfig.enabled) {
    return config;
  }

  return async (env) => {
    let resolvedConfig: RepackRspackConfig;

    if (typeof config === 'function') {
      resolvedConfig = await config(env);
    } else {
      resolvedConfig = config;
    }

    const patchedConfig = patchConfig(resolvedConfig, {
      projectRoot: env.context ?? process.cwd(),
      ...rozeniteConfig,
    });

    if (rozeniteConfig.enhanceRePackConfig) {
      const enhancedConfig = await rozeniteConfig.enhanceRePackConfig(
        patchedConfig
      );
      return enhancedConfig;
    }

    return patchedConfig;
  };
};
