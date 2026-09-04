// Structural types for the slice of the rspack `Compiler`/`Compilation`
// surface this collector needs, mirroring the same approach (and the same
// reasoning) as `@rozenite/middleware`'s `rspack-resolver-plugin.ts`: no
// `@rspack/core` import, since this package doesn't otherwise depend on it
// and the shapes below are stable across rspack versions.
type Module = { resource?: string };

type Compilation = { modules: Iterable<Module> };

type Compiler = {
  hooks: {
    afterCompile: {
      tap: (name: string, fn: (compilation: Compilation) => void) => void;
    };
  };
};

const PLUGIN_NAME = 'RozeniteCollectModulesPlugin';

/**
 * Collects the absolute resource path of every module rspack put in the
 * compilation, the rspeedy/rspack equivalent of Metro's
 * `serializer.processModuleFilter` instrumentation in
 * `../metro/bundle-for-release.ts`. `afterCompile` (not `emit` or `done`)
 * fires once per compilation with `compilation.modules` fully populated,
 * before assets are written -- module identity here, not the emitted asset
 * bytes, is what `bundleForRelease` reports.
 */
export class CollectModulesPlugin {
  private readonly modulePaths: Set<string>;

  constructor(modulePaths: Set<string>) {
    this.modulePaths = modulePaths;
  }

  apply(compiler: Compiler): void {
    compiler.hooks.afterCompile.tap(PLUGIN_NAME, (compilation) => {
      for (const module of compilation.modules) {
        if (module.resource) {
          this.modulePaths.add(module.resource);
        }
      }
    });
  }
}
