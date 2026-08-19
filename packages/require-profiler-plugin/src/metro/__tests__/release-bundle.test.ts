import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withRozenite } from '@rozenite/metro';
import {
  bundleForRelease,
  RELEASE_BUNDLE_TIMEOUT,
  type BundleForReleaseOptions,
} from '@rozenite/test-utils';
import { describe, expect, it } from 'vitest';
import { withRozeniteRequireProfiler } from '../index.js';

// This plugin injects a polyfill into the bundle, so it is exactly the kind
// of integration that can leak into a shipped app. See
// docs/agents/release-bundle-testing.md.
const packageRoot = path.resolve(fileURLToPath(import.meta.url), '../../../..');

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

      // `src` when the test resolves this package's source, `dist` when it
      // resolves the built output.
      expect(result.rozeniteModules).toEqual([
        expect.stringMatching(/^packages\/require-profiler-plugin\/(src|dist)\/metro\/setup\.js$/),
      ]);
    },
    RELEASE_BUNDLE_TIMEOUT,
  );
});
