import { type MetroConfig } from '@react-native/metro-config';
import {
  createScopedMiddleware,
  initializeRozenite,
  type MiddlewareHandler,
  type MiddlewareNext,
  type MiddlewareRequest,
  type RozeniteConfig,
} from '@rozenite/middleware';
import { isBundling, logger } from '@rozenite/tools';
import runtimePackage from '@rozenite/runtime/package.json' with { type: 'json' };
import path from 'node:path';
import { createRozeniteResolveRequest } from './resolver.js';

export type RozeniteMetroConfig<TMetroConfig = unknown> = Omit<RozeniteConfig, 'projectRoot'> & {
  /**
   * Whether to enable Rozenite.
   * If false, Rozenite will not be initialized and the config will be returned as is.
   * @default false
   */
  enabled?: boolean;
  /**
   * Certain Rozenite plugins require Metro to be configured in a specific way.
   * This option allows you to modify the Metro config in a way that is safe to do when bundling.
   */
  enhanceMetroConfig?: (config: TMetroConfig) => Promise<TMetroConfig> | TMetroConfig;
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
};

export const withRozenite = <T extends MetroConfig>(
  config: T | Promise<T>,
  options: RozeniteMetroConfig<T> = {},
): (() => Promise<T>) => {
  return async () => {
    const resolvedConfig = await config;
    const projectRoot = resolvedConfig.projectRoot ?? process.cwd();
    const allowInProduction = options.allowInProduction ?? [];

    if (allowInProduction.length > 0) {
      logger.warn(
        `allowInProduction is set for: ${allowInProduction.join(', ')}. ` +
          'Code from these Rozenite plugin package(s) may reach your production bundle -- ' +
          'this defeats the production guarantee for them. Prefer declaring productionEntries ' +
          "in the plugin's rozenite.config.ts instead.",
      );
    }

    // The guard-only config: no dev server, no middleware, no
    // watchFolders/extraNodeModules, no dev-entry redirect. Everything the
    // `enabled === false` and bundling paths need, and nothing more.
    const withGuardOnly = (): T =>
      ({
        ...resolvedConfig,
        resolver: {
          ...resolvedConfig.resolver,
          resolveRequest: createRozeniteResolveRequest({
            projectRoot,
            allowInProduction,
            installDevEntryRedirect: false,
            previousResolveRequest: resolvedConfig.resolver?.resolveRequest,
          }),
        },
      }) satisfies MetroConfig as T;

    if (options.enabled === undefined) {
      logger.info('Rozenite will no longer be enabled by default in the next version.');
      logger.info('To continue using Rozenite, please set `enabled` in the options.');
      logger.info('Remember to make it conditional to avoid bundling issues.');

      if (isBundling(projectRoot)) {
        return withGuardOnly();
      }
    }

    if (options.enabled === false) {
      return withGuardOnly();
    }

    const { devModePackage, middleware: rozeniteMiddleware } = await initializeRozenite(
      {
        projectRoot,
        ...options,
      },
      runtimePackage.version,
    );

    const rozeniteMetroConfig = {
      ...resolvedConfig,
      watchFolders: devModePackage
        ? [...(resolvedConfig.watchFolders ?? []), devModePackage.path]
        : resolvedConfig.watchFolders,
      resolver: {
        ...resolvedConfig.resolver,
        extraNodeModules: devModePackage
          ? {
              ...(resolvedConfig.resolver?.extraNodeModules ?? {}),
              [devModePackage.name]: require.resolve(devModePackage.name, {
                paths: [projectRoot],
              }),

              // Rozenite package should use the same versions of React and React Native as the app.
              // Using dirname as sometimes developers use deep imports for react-native.
              react: path.dirname(require.resolve('react', { paths: [projectRoot] })),
              'react-native': path.dirname(
                require.resolve('react-native', {
                  paths: [projectRoot],
                }),
              ),
            }
          : resolvedConfig.resolver?.extraNodeModules,
        resolveRequest: createRozeniteResolveRequest({
          projectRoot,
          allowInProduction,
          installDevEntryRedirect: true,
          previousResolveRequest: resolvedConfig.resolver?.resolveRequest,
        }),
      },
      server: {
        ...resolvedConfig.server,
        enhanceMiddleware: (metroMiddleware, server) => {
          const prevMiddleware =
            resolvedConfig.server?.enhanceMiddleware?.(metroMiddleware, server) ?? metroMiddleware;
          const delegatedMetroMiddleware = prevMiddleware as MiddlewareHandler;

          const scopedRozeniteMiddleware = createScopedMiddleware('/rozenite', rozeniteMiddleware);

          return (
            req: MiddlewareRequest,
            res: Parameters<MiddlewareHandler>[1],
            next: MiddlewareNext,
          ) => {
            scopedRozeniteMiddleware(req, res, (error) => {
              if (error) {
                next(error);
                return;
              }

              delegatedMetroMiddleware(req, res, next);
            });
          };
        },
      },
    } satisfies MetroConfig;

    if (options.enhanceMetroConfig) {
      const enhancedConfig = await options.enhanceMetroConfig(rozeniteMetroConfig);
      return enhancedConfig;
    }

    return rozeniteMetroConfig;
  };
};
