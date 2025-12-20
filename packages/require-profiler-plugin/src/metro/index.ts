import type { ConfigT as MetroConfig } from 'metro-config';
import { createRequire } from 'node:module';
import { createMetroConfigTransformer } from '@rozenite/tools';

const require = createRequire(import.meta.url);

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
    const existingGetPolyfills = config.serializer?.getPolyfills ?? (() => []);
    const existingGetRunModuleStatement =
      config.serializer?.getRunModuleStatement ??
      ((moduleId: string | number) => `__r(${JSON.stringify(moduleId)});`);

    return {
      ...config,
      serializer: {
        ...config.serializer,
        getPolyfills: (...opts) => [
          ...existingGetPolyfills(...opts),
          require.resolve('./setup'),
        ],
        getRunModuleStatement: (...opts) => {
          const statement = existingGetRunModuleStatement(...opts);
          return `__patchSystrace();${statement}`;
        },
      },
    };
  },
);
