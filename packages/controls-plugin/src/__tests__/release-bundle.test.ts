import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleForRelease, RELEASE_BUNDLE_TIMEOUT } from '@rozenite/test-utils';
import { describe, expect, it } from 'vitest';

// An app importing this plugin ships its React Native code -- that much is
// the app's own choice. What must never follow it into the bundle is the
// panel: the DevTools UI, its React DOM tree and `@rozenite/ui`.
// See docs/agents/release-bundle-testing.md.
const packageRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');
const reactNativeEntry = path.join(packageRoot, 'dist/react-native/index.cjs');

describe('@rozenite/controls-plugin in a release bundle', () => {
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
        'packages/controls-plugin/dist/react-native/index.cjs',
      );
      expect(result.panelModules).toEqual([]);
    },
    RELEASE_BUNDLE_TIMEOUT,
  );
});
