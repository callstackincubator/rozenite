import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createScopedMiddleware,
  initializeRozenite,
  RozeniteConfig,
  RozeniteMiddleware,
} from '@rozenite/middleware';
import { logger } from '@rozenite/tools';
import { RepackRspackConfig, type RepackRspackConfigExport } from '@callstack/repack';
import { assertSupportedRePackVersion } from './version-check.js';
import { RozeniteResolverPlugin } from './resolver-plugin.js';

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
  /**
   * Rozenite plugin packages that are allowed to reach a production bundle.
   *
   * By default, Rozenite's Metro resolver throws when a production build
   * resolves into a Rozenite plugin package through anything other than
   * that plugin's declared `productionEntries`. This is an escape hatch,
   * not a fix: listing a package here defeats that guarantee for it, and
   * its code -- devtools UI, agent wiring, whatever it ships -- can end up
   * in what you ship to users. Prefer declaring `productionEntries` in the
   * plugin's `rozenite.config.ts` instead. Every package listed here is
   * logged loudly once per build.
   */
  allowInProduction?: string[];
} & Omit<RozeniteConfig, 'projectRoot'>;

export const withRozenite = (
  config: RepackRspackConfigExport,
  rozeniteConfig: RozeniteRePackConfig = {},
): RepackRspackConfigExport => {
  assertSupportedRePackVersion(process.cwd());

  return async (env) => {
    const allowInProduction = rozeniteConfig.allowInProduction ?? [];

    if (allowInProduction.length > 0) {
      logger.warn(
        `allowInProduction is set for: ${allowInProduction.join(', ')}. ` +
          'Code from these Rozenite plugin package(s) may reach your production bundle -- ' +
          'this defeats the production guarantee for them. Prefer declaring productionEntries ' +
          "in the plugin's rozenite.config.ts instead.",
      );
    }

    let resolvedConfig: RepackRspackConfig;

    if (typeof config === 'function') {
      resolvedConfig = await config(env);
    } else {
      resolvedConfig = config;
    }

    const projectRoot = env.context ?? process.cwd();
    const isDev = env.mode !== 'production';

    // `RepackRspackConfig` (via `@callstack/repack`) extends rspack's
    // `Configuration`, whose `plugins` field isn't visible here (see the
    // note atop `resolver-plugin.ts`): `@rspack/core`'s own types aren't
    // resolvable in every context that type-checks/builds this package, and
    // `@callstack/repack` doesn't re-export them. `unknown[]` is enough to
    // append our plugin without needing that type.
    type ConfigWithPlugins = RepackRspackConfig & { plugins?: unknown[] };
    const resolvedConfigWithPlugins = resolvedConfig as ConfigWithPlugins;

    // The guard is installed unconditionally -- `enabled: false` means "no
    // dev server, guard still active", not "do nothing". Only the
    // middleware/dev-server wiring below is gated on `enabled`.
    const guardedConfig: ConfigWithPlugins = {
      ...resolvedConfigWithPlugins,
      plugins: [
        ...(resolvedConfigWithPlugins.plugins ?? []),
        new RozeniteResolverPlugin({
          projectRoot,
          allowInProduction,
          isDev,
          installDevEntryRedirect: rozeniteConfig.enabled === true,
        }),
      ],
    };

    if (!rozeniteConfig.enabled) {
      return guardedConfig;
    }

    return patchConfig(guardedConfig, {
      projectRoot,
      ...rozeniteConfig,
    });
  };
};
