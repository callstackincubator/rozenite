import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createScopedMiddleware,
  initializeRozenite,
  RozeniteConfig,
  RozeniteMiddleware,
} from '@rozenite/middleware';
import { RepackRspackConfig, type RepackRspackConfigExport } from '@callstack/repack';
import { assertSupportedRePackVersion } from './version-check.js';

// Plugin discovery is async, but `setupMiddlewares` is only invoked by the
// dev server (never for a plain `bundle`/production build) and must return
// synchronously. So discovery is kicked off lazily here, memoized for the
// lifetime of this dev server instance, and requests wait on it instead of
// the config-resolution step blocking on it upfront.
const createLazyRozeniteMiddleware = (rozeniteConfig: RozeniteConfig) => {
  let middlewarePromise: Promise<RozeniteMiddleware> | null = null;

  const getRozeniteMiddleware = (): Promise<RozeniteMiddleware> => {
    middlewarePromise ??= initializeRozenite(rozeniteConfig).then(
      (instance) => instance.middleware,
    );
    return middlewarePromise;
  };

  return async (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    try {
      const rozeniteMiddleware = await getRozeniteMiddleware();
      createScopedMiddleware('/rozenite', rozeniteMiddleware)(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

const patchConfig = (
  config: RepackRspackConfig,
  rozeniteConfig: RozeniteConfig,
): RepackRspackConfig => {
  return {
    ...config,
    devServer: {
      ...config.devServer,
      setupMiddlewares: (middlewares) => {
        middlewares.unshift(createLazyRozeniteMiddleware(rozeniteConfig));
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
