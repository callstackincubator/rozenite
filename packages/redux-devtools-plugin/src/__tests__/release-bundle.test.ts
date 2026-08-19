import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleForRelease, RELEASE_BUNDLE_TIMEOUT } from '@rozenite/test-utils';
import { describe, expect, it } from 'vitest';
import { withRozeniteReduxDevTools } from '../metro.js';

// `withRozeniteReduxDevTools` is a no-op today; this guard is what keeps it
// from quietly starting to inject code into shipped bundles.
//
// The wiring through `withRozenite({ enabled: false })` is covered by
// @rozenite/metro's own suite -- importing it here would pull the middleware
// source into this package's TypeScript program through the `development`
// condition. See docs/agents/release-bundle-testing.md.
const packageRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');
const reactNativeEntry = path.join(packageRoot, 'dist/react-native/index.cjs');

describe('withRozeniteReduxDevTools', () => {
  it(
    'leaves no Rozenite code in a release bundle',
    async () => {
      const result = await bundleForRelease({
        resolveFrom: packageRoot,
        configureMetro: (config) => withRozeniteReduxDevTools(config),
      });

      expect(result.rozeniteModules).toEqual([]);
    },
    RELEASE_BUNDLE_TIMEOUT,
  );
});

describe('@rozenite/redux-devtools-plugin in a release bundle', () => {
  it(
    'ships no panel code when an app imports it',
    async () => {
      const result = await bundleForRelease({
        resolveFrom: packageRoot,
        files: {
          'index.js': `require(${JSON.stringify(reactNativeEntry)});\n`,
        },
      });

      // Keeps the check below honest: the entry really did get bundled.
      expect(result.rozeniteModules).toContain(
        'packages/redux-devtools-plugin/dist/react-native/index.cjs',
      );
      expect(result.panelModules).toEqual([]);
    },
    RELEASE_BUNDLE_TIMEOUT,
  );
});
