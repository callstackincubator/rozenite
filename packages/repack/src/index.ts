import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createScopedMiddleware,
  initializeRozenite,
  RozeniteConfig,
  type MiddlewareHandler,
} from '@rozenite/middleware';
import { RepackRspackConfig, type RepackRspackConfigExport } from '@callstack/repack';
import runtimePackage from '@rozenite/runtime/package.json' with { type: 'json' };
import { assertSupportedRePackVersion } from './version-check.js';

// Plugin discovery is async, but `setupMiddlewares` is only invoked by the
// dev server (never for a plain `bundle`/production build) and must return
// synchronously. So discovery is kicked off lazily here, memoized for the
// lifetime of this dev server instance, and requests wait on it instead of
// the config-resolution step blocking on it upfront.
const createLazyRozeniteMiddleware = (rozeniteConfig: RozeniteConfig) => {
  let middlewarePromise: Promise<MiddlewareHandler> | null = null;

  const getRozeniteMiddleware = (): Promise<MiddlewareHandler> => {
    middlewarePromise ??= initializeRozenite(rozeniteConfig, runtimePackage.version).then(
      (instance) => createScopedMiddleware('/rozenite', instance.middleware),
    );
    return middlewarePromise;
  };

  return async (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    try {
      const rozeniteMiddleware = await getRozeniteMiddleware();
      rozeniteMiddleware(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

const patchConfig = (
  config: RepackRspackConfig,
  rozeniteConfig: RozeniteConfig,
): RepackRspackConfig => {
  const userSetupMiddlewares = config.devServer?.setupMiddlewares;

  return {
    ...config,
    devServer: {
      ...config.devServer,
      setupMiddlewares: (middlewares, devServer) => {
        const userMiddlewares = userSetupMiddlewares
          ? userSetupMiddlewares.call(config.devServer, middlewares, devServer)
          : middlewares;
        userMiddlewares.unshift(createLazyRozeniteMiddleware(rozeniteConfig));
        return userMiddlewares;
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
} & Omit<RozeniteConfig, 'projectRoot'>;

export const withRozenite = (
  config: RepackRspackConfigExport,
  rozeniteConfig: RozeniteRePackConfig = {},
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

    return patchConfig(resolvedConfig, {
      projectRoot: env.context ?? process.cwd(),
      ...rozeniteConfig,
    });
  };
};
