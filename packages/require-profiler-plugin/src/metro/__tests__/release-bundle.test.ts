import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withRozenite } from '@rozenite/metro';
import {
  bundleForRelease,
  RELEASE_BUNDLE_TIMEOUT,
  type BundleForReleaseOptions,
} from '@rozenite/test-utils';
import { describe, expect, it } from 'vitest';

// This plugin injects a polyfill into the bundle, so it is exactly the kind
// of integration that can leak into a shipped app. See
// docs/agents/release-bundle-testing.md.
const require = createRequire(import.meta.url);
const packageRoot = path.resolve(fileURLToPath(import.meta.url), '../../../..');

// The built entry point, not `../index.js`. `setup.js` is a polyfill Metro
// reads straight off disk, and the Metro entry point locates it by walking up
// from its own directory -- a walk that only lands on the package root at the
// depth tsc emits it to (`dist/metro/src/metro/`). Resolved from the source
// it points outside the package, so bundling the source would fail on a
// missing file rather than exercise what ships. `metro-polyfill.test.ts`
// guards the depth itself.
const { withRozeniteRequireProfiler } = require(
  path.join(packageRoot, 'dist', 'metro', 'metro.js'),
) as typeof import('../index.js');

const bundle = (configureMetro: BundleForReleaseOptions['configureMetro']) =>
  bundleForRelease({ resolveFrom: packageRoot, configureMetro });

describe('withRozeniteRequireProfiler', () => {
  it(
    'leaves no Rozenite code in a release bundle when Rozenite is disabled',
    async () => {
      const result = await bundle((config) =>
        withRozenite(config, {
          enabled: false,
          enhanceMetroConfig: withRozeniteRequireProfiler,
        }),
      );

      expect(result.rozeniteModules).toEqual([]);
    },
    RELEASE_BUNDLE_TIMEOUT,
  );

  it(
    'does inject its polyfill when applied on its own, so the check above is not vacuous',
    async () => {
      const result = await bundle((config) => withRozeniteRequireProfiler(config));

      // The polyfill ships uncompiled, so it is the `src` copy that gets
      // bundled even though the entry point applying it comes from `dist`.
      expect(result.rozeniteModules).toEqual([
        'packages/require-profiler-plugin/src/metro/setup.js',
      ]);
    },
    RELEASE_BUNDLE_TIMEOUT,
  );
});
