import path from 'node:path';
import type { Config as RspeedyConfig, RsbuildPlugin } from '@lynx-js/rspeedy';
import { monorepoRoot } from '../metro/paths.js';
import { getPanelModules, getRozeniteModules } from '../metro/rozenite-modules.js';
import { createRspeedyFixture } from './fixture.js';
import { CollectModulesPlugin } from './collect-modules-plugin.js';

export type RspeedyReleaseBundleOptions = {
  /**
   * Files written into the throwaway Lynx app, keyed by path relative to
   * its root.
   * @default a single `src/index.js` logging a line
   */
  files?: Record<string, string>;
  /**
   * The app's plugins, applied in this order -- typically
   * `[...pluginReactLynx(), rozeniteLynxPlugin(options)]`. This bench
   * builds the `lynx` environment only (`environment: ['lynx']`, matching
   * `createRspeedy`'s option of the same name), so a web-target plugin
   * (`pluginReactLynx({ target: 'web' })`, `@rozenite/lynx-web`) has
   * nothing to build here.
   */
  plugins: RsbuildPlugin[];
  /**
   * Directory whose `node_modules` is added to the fixture's resolution
   * paths, mirroring `../metro/bundle-for-release.ts`'s option of the same
   * name. Pass the root of the package under test (e.g. `packages/lynx`)
   * so a workspace dependency it declares -- a Rozenite plugin used only
   * to exercise the guard, say -- resolves from the fixture: under this
   * monorepository's `nodeLinker: hoisted`, a workspace package is
   * symlinked into each of its *consumers'* own `node_modules`, not
   * hoisted to the repository root the way a third-party dependency is,
   * so the fixture's symlink to the repository root alone
   * (`createRspeedyFixture`) does not see it.
   * @default process.cwd()
   */
  resolveFrom?: string;
};

export type RspeedyReleaseBundle = {
  /** Absolute paths of every real module rspack put in the compilation. */
  modules: string[];
  /**
   * The subset of `modules` that belongs to Rozenite, relative to the
   * monorepository root. A release bundle must leave this empty.
   */
  rozeniteModules: string[];
  /**
   * The subset of `rozeniteModules` that belongs to a plugin's DevTools
   * panel. This must be empty even when an app deliberately imports a
   * plugin's device-side code.
   */
  panelModules: string[];
};

const DEFAULT_FILES = {
  'src/index.js': "console.log('rozenite release bundle fixture');\n",
};

type StatsErrorLike = { message?: string };

/**
 * Bundles a throwaway Lynx app in release mode through rspeedy's JavaScript
 * API (`createRspeedy` + `.build()`) and reports what ended up inside --
 * the rspeedy counterpart to `../metro/bundle-for-release.ts`'s
 * `bundleForRelease`, needed for the same reason
 * `docs/agents/release-bundle-testing.md` requires one per bundler
 * integration: `result.modules` (and the `rozeniteModules`/`panelModules`
 * derived from it) are read from rspack's own module graph, not grepped out
 * of emitted source, so an injected leak that carries no `@rozenite` string
 * in the bundle text still gets caught.
 *
 * `.build()` rejects with a generic `Error('Rspack build failed.')` on a
 * compile error -- rsbuild logs the real message rather than attaching it
 * to the rejection (verified against `@rsbuild/core`'s `build_build`). This
 * function captures the real message itself, via `onAfterBuild` (which
 * fires with populated `stats.errors` regardless of whether the build
 * succeeded), and re-throws with it, so a caller can assert on the message
 * `RozeniteResolverPlugin` actually produced -- e.g. the importing file's
 * path -- exactly as the Metro bench's callers do.
 */
export const bundleForRelease = async ({
  files = DEFAULT_FILES,
  plugins,
  resolveFrom = process.cwd(),
}: RspeedyReleaseBundleOptions): Promise<RspeedyReleaseBundle> => {
  const fixture = createRspeedyFixture(files);

  try {
    const modulePaths = new Set<string>();
    let capturedErrors: StatsErrorLike[] = [];

    const collectorPlugin: RsbuildPlugin = {
      name: 'rozenite-test-utils-collect-modules',
      setup: (api) => {
        api.modifyRspackConfig((config) => {
          config.plugins.push(new CollectModulesPlugin(modulePaths));
          config.resolve.modules = [
            path.join(fixture.root, 'node_modules'),
            path.join(resolveFrom, 'node_modules'),
            path.join(monorepoRoot, 'node_modules'),
            'node_modules',
          ];
        });
        api.onAfterBuild(({ stats }) => {
          // `stats` is rspack's own `Stats | MultiStats`, not the trimmed
          // `RsbuildStats` shape (`Pick<StatsCompilation, 'errors' | ...>`)
          // -- it carries the actual per-error `message` only via
          // `.toJson()`, not as a plain property.
          const json = stats?.toJson({ all: false, errors: true }) as
            | { errors?: StatsErrorLike[] }
            | undefined;
          capturedErrors = json?.errors ?? [];
        });
      },
    };

    const rspeedyConfig: RspeedyConfig = {
      mode: 'production',
      plugins: [...plugins, collectorPlugin],
      // Silence rsbuild's own progress/summary output, and don't ask the
      // fixture's throwaway package.json for browser targets it doesn't
      // declare.
      performance: { printFileSize: false },
    };

    const { createRspeedy } = await import('@lynx-js/rspeedy');

    const rspeedy = await createRspeedy({
      cwd: fixture.root,
      rspeedyConfig,
      environment: ['lynx'],
      loadEnv: false,
    });

    try {
      await rspeedy.build();
    } catch (error) {
      const detail = capturedErrors
        .map((e) => e.message)
        .filter((message): message is string => typeof message === 'string')
        .join('\n');

      throw detail.length > 0 ? new Error(detail) : error;
    }

    const modules = [...modulePaths]
      // rspack reports loader-prefixed resources (`<loader>!<file>`) for
      // some virtual/generated modules; keep only real, absolute file
      // paths so `getRozeniteModules`/`getPanelModules` (which do a plain
      // `path.relative` against the monorepository root) never choke on a
      // loader-request string that happens to contain `@rozenite`.
      .filter((modulePath) => path.isAbsolute(modulePath) && !modulePath.includes('!'))
      .sort();

    return {
      modules,
      rozeniteModules: getRozeniteModules(modules),
      panelModules: getPanelModules(modules),
    };
  } finally {
    fixture.cleanup();
  }
};
