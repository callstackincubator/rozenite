import type { CustomResolutionContext, CustomResolver, Resolution } from 'metro-resolver';
import {
  findRozenitePluginForFile,
  isDevEntryOrigin,
  isSeamDevEntryRequest,
  formatProductionGuardError,
  formatDevAdvisory,
  warnOnceForImport,
  getDevEntrySpecifier,
  type RozenitePluginPackage,
} from '@rozenite/middleware';
import { logger } from '@rozenite/tools';

const WEB_SOCKET_INTERCEPTOR_MODULE = 'react-native/Libraries/WebSocket/WebSocketInterceptor';

// Resolving a plugin's declared `productionEntries` must go through the host
// resolver (Metro's own standard algorithm, via `context.resolveRequest`),
// not Node's `require.resolve` -- Node applies different export conditions
// than Metro does and the two can land on different files, which would turn
// a legitimate import into a false build failure. Memoized per
// (pluginRoot, platform), alongside the `productionEntries` it was resolved
// from: `findRozenitePluginForFile` (in `@rozenite/middleware`) already
// re-reads a plugin's manifest when it changes underneath `rozenite dev`, so
// comparing against that fresh value is what tells this cache its resolved
// paths are stale, without this module re-stat'ing the manifest itself.
type DeclaredEntriesCacheEntry = {
  paths: Set<string>;
  productionEntries: string[];
};
const declaredEntriesCache = new Map<string, DeclaredEntriesCacheEntry>();

const sameProductionEntries = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((entry, index) => entry === b[index]);

/**
 * A declared entry is an *export subpath*, so it has to be resolved as the
 * bare specifier a consumer would actually write -- `./register` becomes
 * `@acme/some-plugin/register`. Resolving `./register` as a literal relative
 * path instead would walk the plugin's own directory and land on its source
 * `register.ts`, while the consumer's import goes through the `exports` map
 * to `dist/react-native/register.js`. The two never match, so a correctly
 * declared entry would fail the guard.
 */
const getEntrySpecifier = (pluginName: string, entry: string): string => {
  return entry === '.' ? pluginName : `${pluginName}/${entry.replace(/^\.\//, '')}`;
};

// Re-entrancy flag: resolving declared entries below re-enters
// `context.resolveRequest`, which per Metro's design is the built-in
// standard resolver (not this custom resolver) and so cannot actually loop
// back here. This flag is kept anyway as a defensive backstop so that inner
// resolution never re-triggers the guard, regardless of how a given Metro
// version or a test double wires `resolveRequest`.
let isResolvingDeclaredEntries = false;

const resolveDeclaredEntries = (
  plugin: RozenitePluginPackage,
  context: CustomResolutionContext,
  platform: string | null,
): Set<string> => {
  const cacheKey = `${plugin.root}\0${platform ?? ''}`;
  const cached = declaredEntriesCache.get(cacheKey);

  if (cached && sameProductionEntries(cached.productionEntries, plugin.productionEntries)) {
    return cached.paths;
  }

  const resolvedPaths = new Set<string>();

  if (plugin.productionEntries.length > 0) {
    isResolvingDeclaredEntries = true;

    try {
      for (const entry of plugin.productionEntries) {
        let resolution: Resolution;

        try {
          // Resolved from the importing module, not from the plugin root or
          // the project root: that is the exact context the import being
          // checked resolved in, so the two cannot disagree. The plugin is
          // already known to be reachable from here -- we only got this far
          // because a resolution landed inside it.
          resolution = context.resolveRequest(
            context,
            getEntrySpecifier(plugin.name, entry),
            platform,
          );
        } catch (error) {
          const cause = error instanceof Error ? error.message : String(error);
          throw new Error(
            `${plugin.name} declares "${entry}" as a production entry point, but it could not be resolved: ${cause}`,
          );
        }

        if (resolution.type === 'sourceFile') {
          resolvedPaths.add(resolution.filePath);
        } else if (resolution.type === 'assetFiles') {
          resolution.filePaths.forEach((filePath) => resolvedPaths.add(filePath));
        }
      }
    } finally {
      isResolvingDeclaredEntries = false;
    }
  }

  declaredEntriesCache.set(cacheKey, {
    paths: resolvedPaths,
    productionEntries: [...plugin.productionEntries],
  });
  return resolvedPaths;
};

export type ProductionGuardOptions = {
  projectRoot: string;
  allowInProduction: string[];
};

/**
 * Deciding whether a resolution is allowed, in order:
 * 1. importer is itself inside a Rozenite plugin package -> allow.
 * 2. resolved file is not inside a Rozenite plugin package -> allow.
 * 3. plugin is listed in allowInProduction -> allow.
 * 4. resolved file IS one of the plugin's declared productionEntries -> allow.
 * 5. otherwise: production -> throw; development -> warn (suppressed for
 *    the dev entry itself).
 */
export const applyProductionGuard = (
  context: CustomResolutionContext,
  resolution: Resolution,
  platform: string | null,
  options: ProductionGuardOptions,
): Resolution => {
  if (isResolvingDeclaredEntries) {
    return resolution;
  }

  if (resolution.type !== 'sourceFile') {
    return resolution;
  }

  const originModulePath = context.originModulePath;

  if (findRozenitePluginForFile(originModulePath)) {
    return resolution;
  }

  const plugin = findRozenitePluginForFile(resolution.filePath);

  if (!plugin) {
    return resolution;
  }

  if (options.allowInProduction.includes(plugin.name)) {
    return resolution;
  }

  const declaredEntryPaths = resolveDeclaredEntries(plugin, context, platform);

  if (declaredEntryPaths.has(resolution.filePath)) {
    return resolution;
  }

  if (!context.dev) {
    throw new Error(
      formatProductionGuardError({
        plugin,
        importedFrom: originModulePath,
        projectRoot: options.projectRoot,
      }),
    );
  }

  if (!isDevEntryOrigin(originModulePath)) {
    warnOnceForImport(
      `${originModulePath}\0${plugin.name}`,
      formatDevAdvisory({
        plugin,
        importedFrom: originModulePath,
        projectRoot: options.projectRoot,
      }),
    );
  }

  return resolution;
};

let hasWarnedMissingDevEntry = false;

export type RozeniteResolverOptions = {
  projectRoot: string;
  allowInProduction: string[];
  /**
   * Only true when Rozenite is actually enabled (`enabled === true`): the
   * dev-entry redirect has no reason to run when Rozenite isn't wired up,
   * and must never run when the guard-only config is installed
   * (`enabled === false`, or the undefined-default bundling path).
   */
  installDevEntryRedirect: boolean;
  previousResolveRequest?: CustomResolver | null;
};

/**
 * Builds the `resolveRequest` Rozenite installs on the Metro config. Always
 * preserves the pre-existing `WebSocketInterceptor` web special case and
 * delegation to a user-supplied `resolveRequest` (falling back to Metro's
 * own `context.resolveRequest`). Optionally redirects the seam package's
 * dev-entry request to the project's `rozenite.dev` file. Always applies the
 * production guard to the resulting resolution.
 */
export const createRozeniteResolveRequest = (options: RozeniteResolverOptions): CustomResolver => {
  return (context, moduleName, platform) => {
    if (platform === 'web' && moduleName === WEB_SOCKET_INTERCEPTOR_MODULE) {
      return { type: 'empty' };
    }

    if (
      options.installDevEntryRedirect &&
      context.dev &&
      isSeamDevEntryRequest(context.originModulePath, moduleName)
    ) {
      const devEntrySpecifier = getDevEntrySpecifier(options.projectRoot);

      try {
        return context.resolveRequest(context, devEntrySpecifier, platform);
      } catch {
        // A missing rozenite.dev file must never break the build: fall
        // through to normal resolution below, which resolves the literal
        // './dev-entry.js' request to the seam's shipped noop.
        if (!hasWarnedMissingDevEntry) {
          hasWarnedMissingDevEntry = true;
          logger.warn(
            `No rozenite.dev file found at ${devEntrySpecifier} (checked with your configured sourceExts ` +
              'and platform extensions). <Rozenite /> will render nothing until you add one.',
          );
        }
      }
    }

    const resolution =
      options.previousResolveRequest?.(context, moduleName, platform) ??
      context.resolveRequest(context, moduleName, platform);

    return applyProductionGuard(context, resolution, platform, {
      projectRoot: options.projectRoot,
      allowInProduction: options.allowInProduction,
    });
  };
};
