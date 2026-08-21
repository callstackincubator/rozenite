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
 */
export const withRozeniteRequireProfiler = createMetroConfigTransformer(
  (config: MetroConfig): MetroConfig => {
    // Metro adds `getPolyfills` entries to the graph by absolute path, not
    // through module resolution, so Rozenite's production resolver guard never
    // sees this one. This check is the only thing keeping the instrumentation
    // out of a release bundle. The profiler reports over the DevTools bridge
    // and does nothing without a dev server anyway, so a bundle run has no use
    // for it either way.
    if (isBundling(config.projectRoot ?? process.cwd())) {
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
