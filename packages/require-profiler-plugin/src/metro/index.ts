import type { ConfigT as MetroConfig } from 'metro-config';
import path from 'node:path';
import { createMetroConfigTransformer, isBundling } from '@rozenite/tools';

// `setup.js` is a Metro polyfill: Metro injects it into the app bundle and
// executes it verbatim, so it must never be compiled, bundled or otherwise
// processed. It is therefore referenced straight out of the published `src`
// directory rather than copied through the build.
//
// The Metro entry point is emitted as CommonJS at dist/metro/src/metro/, so
// four levels up from this file is the package root. Guarded by
// `metro-polyfill.test.ts`, which runs against the built output.
const PACKAGE_ROOT = path.join(__dirname, '..', '..', '..', '..');
const SETUP_POLYFILL_PATH = path.join(PACKAGE_ROOT, 'src', 'metro', 'setup.js');

export type RozeniteRequireProfilerOptions = {
  /**
   * Whether to instrument the bundle.
   * @default process.env.NODE_ENV !== 'production'
   */
  enabled?: boolean;
};

/**
 * Metro config wrapper for require profiling instrumentation.
 *
 * Usage:
 * ```js
 * const { withRequireProfiler } = require('metro-require-instrument');
 *
 * const config = getDefaultConfig(__dirname);
 * module.exports = withRequireProfiler(config);
 * ```
 */

/**
 * Wraps an existing Metro config to enable require profiling instrumentation.
 * This adds timing instrumentation to track module require() calls.
 *
 * Instrumentation is dev-only. The primary gate is `withRozenite`'s own
 * `enabled` option: when it is false, `enhanceMetroConfig` never runs and
 * this transformer is never reached. Two further layers cover the cases that
 * sit outside it — a config that enables Rozenite unconditionally, and using
 * this wrapper standalone, without `withRozenite` at all:
 *
 * - Config time (here): `enabled` defaults to `NODE_ENV !== 'production'`,
 *   and when disabled the config is returned untouched.
 * - Runtime: `setup.js` is guarded by `__DEV__`, which Metro's transformer
 *   inlines to `false` and then dead-code-eliminates in a production build.
 *   Should the polyfill ship anyway it defines nothing, which leaves the
 *   `__patchSystrace` prepend below a no-op — it already guards with
 *   `typeof __patchSystrace === "function"`.
 */
export const withRozeniteRequireProfiler =
  createMetroConfigTransformer<RozeniteRequireProfilerOptions>(
    (config: MetroConfig, options): MetroConfig => {
      const enabled = options?.enabled ?? process.env.NODE_ENV !== 'production';

      // Metro adds `getPolyfills` entries to the graph by absolute path, not
      // through module resolution, so Rozenite's production resolver guard never
      // sees this one. This check is the only thing keeping the instrumentation
      // out of a release bundle when `enabled` folds to `true` regardless (e.g.
      // `NODE_ENV` unset) -- the profiler reports over the DevTools bridge and
      // does nothing without a dev server anyway, so a bundle run has no use for
      // it either way.
      if (!enabled || isBundling(config.projectRoot ?? process.cwd())) {
        return config;
      }

      const existingGetPolyfills = config.serializer?.getPolyfills ?? (() => []);
      const existingGetRunModuleStatement =
        config.serializer?.getRunModuleStatement ??
        ((moduleId: string | number) => `__r(${JSON.stringify(moduleId)});`);

      return {
        ...config,
        serializer: {
          ...config.serializer,
          getPolyfills: (...opts) => [...existingGetPolyfills(...opts), SETUP_POLYFILL_PATH],
          getRunModuleStatement: (...opts) => {
            const statement = existingGetRunModuleStatement(...opts);
            return `typeof __patchSystrace === "function" && __patchSystrace();\n${statement}`;
          },
        },
      };
    },
  );
