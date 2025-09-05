import { initializeRozenite, RozeniteConfig } from '@rozenite/middleware';
import {
  RepackRspackConfig,
  RepackRspackConfigAsyncFn,
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

export type RozeniteRePackConfig = Omit<RozeniteConfig, 'projectRoot'>;

export const withRozenite = (
  config: RepackRspackConfigExport,
  rozeniteConfig: RozeniteRePackConfig = {}
): RepackRspackConfigAsyncFn => {
  assertSupportedRePackVersion(process.cwd());

  return async (env) => {
    let resolvedConfig: RepackRspackConfig;

    if (typeof config === 'function') {
      // TODO: This needs to be fixed in Re.Pack
      resolvedConfig = (await config(env)) as RepackRspackConfig;
    } else {
      resolvedConfig = config;
    }

    return patchConfig(resolvedConfig, {
      projectRoot: env.context ?? process.cwd(),
      ...rozeniteConfig,
    });
  };
};
