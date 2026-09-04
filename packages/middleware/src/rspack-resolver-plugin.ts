import fs from 'node:fs';
import path from 'node:path';
import {
  findRozenitePluginForFile,
  isDevEntryOrigin,
  isSeamDevEntryRequest,
  formatProductionGuardError,
  formatDevAdvisory,
  formatIntegrationMismatchError,
  formatIntegrationMismatchAdvisory,
  warnOnceForImport,
  getDevEntrySpecifier,
  type RozenitePluginPackage,
} from './production-guard.js';
import { logger, type RozeniteIntegration } from '@rozenite/tools';

// We intentionally do NOT import types (or values) from `@rspack/core` here.
// It's an optional peer dependency of `@callstack/repack` -- not guaranteed
// to be resolvable wherever `@rozenite/repack` itself is type-checked, built,
// or consumed -- and `@callstack/repack` does not re-export its types for us
// to borrow. The shapes below describe exactly the slice of the
// NormalModuleFactory-hooks surface we touch, which rspack implements
// identically to webpack.
type ContextInfo = { issuer: string };

type ResolveData = {
  request: string;
  context: string;
  contextInfo: ContextInfo;
  createData?: { resource?: string };
};

type Tappable<T> = { tap: (name: string, fn: (arg: T) => void) => void };

type Resolver = {
  resolveSync: (context: object, path: string, request: string) => string | false;
};

type ResolverFactory = {
  get: (type: string, resolveOptions?: unknown) => Resolver;
};

type NormalModuleFactory = {
  hooks: {
    beforeResolve: Tappable<ResolveData>;
    afterResolve: Tappable<ResolveData>;
  };
  resolverFactory: ResolverFactory;
};

type Compilation = {
  errors: Error[];
  resolverFactory: ResolverFactory;
};

// Both webpack and rspack compilers expose the module namespace on
// `compiler.webpack`/`compiler.rspack` precisely so plugins never have to
// import the bundler package themselves just to reach a constructor like
// `WebpackError`.
type BundlerNamespace = { WebpackError: new (message: string) => Error };

type Compiler = {
  webpack?: BundlerNamespace;
  rspack?: BundlerNamespace;
  options: {
    resolve?: {
      extensions?: string[];
    };
  };
  hooks: {
    normalModuleFactory: Tappable<NormalModuleFactory>;
    compilation: {
      tap: (
        name: string,
        fn: (
          compilation: Compilation,
          params: { normalModuleFactory: NormalModuleFactory },
        ) => void,
      ) => void;
    };
  };
};

const PLUGIN_NAME = 'RozeniteResolverPlugin';

/**
 * A declared entry is an *export subpath*, so it has to be resolved as the
 * bare specifier a consumer would actually write -- `./register` becomes
 * `@acme/some-plugin/register`. Resolving `./register` as a literal relative
 * path instead would walk the plugin's own directory and land on its source
 * `register.ts`, while the consumer's import goes through the `exports` map
 * to `dist/react-native/register.js`. The two never match, so a correctly
 * declared entry would fail the guard. Mirrors
 * `packages/metro/src/resolver.ts`'s `getEntrySpecifier` exactly.
 */
const getEntrySpecifier = (pluginName: string, entry: string): string => {
  return entry === '.' ? pluginName : `${pluginName}/${entry.replace(/^\.\//, '')}`;
};

const getWebpackErrorConstructor = (compiler: Compiler): new (message: string) => Error => {
  return compiler.webpack?.WebpackError ?? compiler.rspack?.WebpackError ?? Error;
};

/**
 * `resolveData.contextInfo.issuer` is the importing file's absolute path,
 * exactly what `originModulePath` means throughout `@rozenite/middleware`'s
 * shared core -- present at every stage of resolution (`beforeResolve`
 * through `afterResolve`), since it's the same `ResolveData` object mutated
 * in place as resolution proceeds. It's only empty for the handful of
 * modules that have no issuer (e.g. the bundle entry point itself); in that
 * case we fall back to a path built from `resolveData.context` (the
 * importing module's directory), because every shared-core helper that takes
 * an "origin module path" immediately does `path.dirname(originModulePath)`
 * -- passing a directory directly would make that dirname() call walk one
 * level too high.
 */
const getOriginModulePath = (resolveData: ResolveData): string => {
  return resolveData.contextInfo.issuer || path.join(resolveData.context, '<entry>');
};

let hasWarnedMissingDevEntry = false;

export type RozeniteResolverPluginOptions = {
  projectRoot: string;
  allowInProduction: string[];
  /** Whether this compiler is bundling for production (`env.mode === 'production'`). */
  isDev: boolean;
  /**
   * Only true when Rozenite is actually enabled (`enabled === true`): the
   * dev-entry redirect has no reason to run when Rozenite isn't wired up,
   * and must never run when the guard-only config is installed
   * (`enabled === false`).
   */
  installDevEntryRedirect: boolean;
  /**
   * When set, a plugin resolved into this bundle must declare this
   * integration in its manifest's `integrations` (see
   * `@rozenite/tools/integration`), or the guard fails it the same way it
   * fails an undeclared production entry. Omitted entirely (as `@rozenite/repack`
   * does today) means no integration is checked -- this is additive, not a
   * behaviour change for existing callers.
   */
  targetIntegration?: RozeniteIntegration;
  /**
   * The function whose `allowInProduction` option bypasses the production
   * guard, named in its error message. `withRozenite()` for
   * `@rozenite/repack`; `@rozenite/lynx` passes `rozeniteLynxPlugin()`.
   * @default 'withRozenite()'
   */
  setupFunctionName?: string;
};

/**
 * A single rspack plugin implementing both Rozenite behaviours documented in
 * `packages/metro/src/resolver.ts`, mirrored here so Metro and Re.Pack cannot
 * drift:
 *
 * 1. In development, redirects the `@rozenite/react-native` seam's
 *    `./dev-entry.js` request to the project's `rozenite.dev` file, falling
 *    back (with a once-only warning) to the shipped noop when absent.
 * 2. Unconditionally guards production bundles against importing Rozenite
 *    plugin code that was never declared reachable in production.
 *
 * Lives in `@rozenite/middleware` rather than `@rozenite/repack` so it can be
 * shared with `@rozenite/lynx` (issue #492), which installs the same plugin
 * through Rsbuild's `modifyRspackConfig` and must not depend on
 * `@rozenite/repack`. It stays free of any `@rspack/core` dependency (see the
 * hand-written structural types above) so pulling it in adds no rspack
 * dependency to the middleware.
 */
export class RozeniteResolverPlugin {
  private readonly options: RozeniteResolverPluginOptions;

  // Memoized per plugin package root. One plugin instance is created per
  // `withRozenite` config-function invocation, which Re.Pack calls once per
  // platform/compiler -- so this is equivalent to Metro's
  // per-(pluginRoot, platform) memoization without needing platform in the
  // key.
  private readonly declaredEntriesCache = new Map<string, Set<string>>();

  // Defensive backstop: `Resolver#resolveSync` below is enhanced-resolve's
  // own direct resolution, not the NormalModuleFactory pipeline, so it
  // cannot actually re-trigger `afterResolve`. Kept anyway so resolving a
  // declared entry never recurses back into the guard, regardless of rspack
  // version.
  private isResolvingDeclaredEntries = false;

  constructor(options: RozeniteResolverPluginOptions) {
    this.options = options;
  }

  apply(compiler: Compiler): void {
    if (this.options.installDevEntryRedirect) {
      compiler.hooks.normalModuleFactory.tap(PLUGIN_NAME, (normalModuleFactory) => {
        normalModuleFactory.hooks.beforeResolve.tap(PLUGIN_NAME, (resolveData) => {
          this.redirectDevEntry(resolveData, compiler);
        });
      });
    }

    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation, { normalModuleFactory }) => {
      normalModuleFactory.hooks.afterResolve.tap(PLUGIN_NAME, (resolveData) => {
        this.applyProductionGuard(resolveData, compiler, compilation, normalModuleFactory);
      });
    });
  }

  private redirectDevEntry(resolveData: ResolveData, compiler: Compiler): void {
    if (!this.options.isDev) {
      return;
    }

    const originModulePath = getOriginModulePath(resolveData);

    if (!isSeamDevEntryRequest(originModulePath, resolveData.request)) {
      return;
    }

    const devEntrySpecifier = getDevEntrySpecifier(this.options.projectRoot);

    // A missing `rozenite.dev` file must never fail the build: rewriting
    // `resolveData.request` unconditionally would turn a missing file into
    // an unresolvable specifier (rspack's `NormalModuleReplacementPlugin`
    // approach doesn't even take effect here -- verified). So we check for
    // it ourselves, synchronously, honouring the same extensions the
    // bundler would, and resolve it to a concrete, fully-specified file.
    //
    // Rewriting to the EXTENSIONLESS specifier and letting `resolve.extensions`
    // pick the file (as an initial reading of this problem suggested) does
    // NOT work for this seam in practice: `@rozenite/react-native` ships as
    // a strict ES module (`"type": "module"`), and Node/webpack ESM
    // resolution requires import specifiers from a strict ESM importer to be
    // "fully specified" (extension included) -- an extensionless rewrite
    // fails there with "the request ... failed to resolve only because it
    // was resolved as fully specified". Resolving the concrete file
    // ourselves and rewriting straight to it sidesteps that rule entirely
    // and works for both ESM and CommonJS importers.
    const devEntryFile = this.findDevEntryFile(devEntrySpecifier, compiler);

    if (!devEntryFile) {
      if (!hasWarnedMissingDevEntry) {
        hasWarnedMissingDevEntry = true;
        logger.warn(
          `No rozenite.dev file found at ${devEntrySpecifier} (checked with your configured resolve.extensions). ` +
            '<Rozenite /> will render nothing until you add one.',
        );
      }
      return;
    }

    resolveData.request = devEntryFile;
  }

  /**
   * Resolves `<projectRoot>/rozenite.dev` to a concrete file, honouring the
   * same `resolve.extensions` the bundler would (already carrying this
   * project's platform variants, e.g. `.ios.tsx`) and the same priority a
   * real resolve would use: a flat file (`rozenite.dev.tsx`,
   * `rozenite.dev.ios.tsx`, ...) before a directory's index
   * (`rozenite.dev/index.tsx`, `rozenite.dev/index.web.tsx`, ...). Returns
   * `null` when neither form exists -- the caller falls back to the seam's
   * shipped noop rather than failing the build.
   */
  private findDevEntryFile(devEntrySpecifier: string, compiler: Compiler): string | null {
    const extensions = compiler.options.resolve?.extensions ?? [];

    for (const ext of extensions) {
      const candidate = devEntrySpecifier + ext;
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    for (const ext of extensions) {
      const candidate = path.join(devEntrySpecifier, `index${ext}`);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * Resolving a plugin's declared `productionEntries` must go through
   * rspack's own resolver -- not Node's `require.resolve` -- so export
   * conditions match what the build actually used (a literal relative
   * resolve of `./register` lands on the plugin's source `register.ts`
   * instead of the `exports`-mapped `dist/react-native/register.js` a real
   * consumer import resolves to).
   */
  private resolveDeclaredEntries(
    plugin: RozenitePluginPackage,
    resolveData: ResolveData,
    resolverFactory: ResolverFactory,
  ): Set<string> {
    const cached = this.declaredEntriesCache.get(plugin.root);

    if (cached) {
      return cached;
    }

    const resolvedPaths = new Set<string>();

    if (plugin.productionEntries.length > 0) {
      this.isResolvingDeclaredEntries = true;

      try {
        const resolver = resolverFactory.get('normal');

        for (const entry of plugin.productionEntries) {
          const specifier = getEntrySpecifier(plugin.name, entry);
          // Resolved from the importing module's directory, not from the
          // plugin root or the project root: that is the exact context the
          // import being checked resolved in, so the two cannot disagree.
          //
          // `resolveSync` is typed as returning `false` on failure, but in
          // practice (rspack 2.0.0-alpha.1) it THROWS instead -- verified
          // with a deliberately unresolvable declared entry, which raised a
          // raw `RspackResolver(NotFound(...))` error rather than returning
          // `false`. Catch both shapes so a typo always reads as our own
          // clearly-worded error, not the resolver's raw one.
          let resolved: string | false;

          try {
            resolved = resolver.resolveSync({}, resolveData.context, specifier);
          } catch {
            resolved = false;
          }

          if (!resolved) {
            throw new Error(
              `${plugin.name} declares "${entry}" as a production entry point, but it could not be resolved.`,
            );
          }

          resolvedPaths.add(resolved);
        }
      } finally {
        this.isResolvingDeclaredEntries = false;
      }
    }

    this.declaredEntriesCache.set(plugin.root, resolvedPaths);
    return resolvedPaths;
  }

  /**
   * Deciding whether a resolution is allowed, in the same order as
   * `applyProductionGuard` in `packages/metro/src/resolver.ts`:
   * 1. importer is itself inside a Rozenite plugin package -> allow.
   * 2. resolved file is not inside a Rozenite plugin package -> allow.
   * 3. plugin is listed in allowInProduction -> allow.
   * 4. resolved file IS one of the plugin's declared productionEntries -> allow.
   * 5. otherwise: production -> fail the build; development -> warn once
   *    (suppressed for the dev entry itself).
   */
  private applyProductionGuard(
    resolveData: ResolveData,
    compiler: Compiler,
    compilation: Compilation,
    normalModuleFactory: NormalModuleFactory,
  ): void {
    if (this.isResolvingDeclaredEntries) {
      return;
    }

    const resolvedFile = resolveData.createData?.resource;

    if (!resolvedFile) {
      return;
    }

    const originModulePath = getOriginModulePath(resolveData);

    if (findRozenitePluginForFile(originModulePath)) {
      return;
    }

    const plugin = findRozenitePluginForFile(resolvedFile);

    if (!plugin) {
      return;
    }

    if (this.options.allowInProduction.includes(plugin.name)) {
      return;
    }

    const { targetIntegration } = this.options;

    if (targetIntegration && !plugin.integrations.includes(targetIntegration)) {
      if (!this.options.isDev) {
        const WebpackError = getWebpackErrorConstructor(compiler);
        compilation.errors.push(
          new WebpackError(
            formatIntegrationMismatchError({
              plugin,
              importedFrom: originModulePath,
              projectRoot: this.options.projectRoot,
              targetIntegration,
              setupFunctionName: this.options.setupFunctionName,
            }),
          ),
        );
        return;
      }

      if (!isDevEntryOrigin(originModulePath)) {
        warnOnceForImport(
          `${originModulePath}\0${plugin.name}\0integration`,
          formatIntegrationMismatchAdvisory({
            plugin,
            importedFrom: originModulePath,
            projectRoot: this.options.projectRoot,
            targetIntegration,
          }),
        );
      }
      return;
    }

    let declaredEntryPaths: Set<string>;

    try {
      declaredEntryPaths = this.resolveDeclaredEntries(
        plugin,
        resolveData,
        normalModuleFactory.resolverFactory,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const WebpackError = getWebpackErrorConstructor(compiler);
      compilation.errors.push(new WebpackError(message));
      return;
    }

    if (declaredEntryPaths.has(resolvedFile)) {
      return;
    }

    if (!this.options.isDev) {
      const WebpackError = getWebpackErrorConstructor(compiler);
      compilation.errors.push(
        new WebpackError(
          formatProductionGuardError({
            plugin,
            importedFrom: originModulePath,
            projectRoot: this.options.projectRoot,
            setupFunctionName: this.options.setupFunctionName,
          }),
        ),
      );
      return;
    }

    if (!isDevEntryOrigin(originModulePath)) {
      warnOnceForImport(
        `${originModulePath}\0${plugin.name}`,
        formatDevAdvisory({
          plugin,
          importedFrom: originModulePath,
          projectRoot: this.options.projectRoot,
        }),
      );
    }
  }
}
