import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleForRelease, RELEASE_BUNDLE_TIMEOUT } from '@rozenite/test-utils';
import { describe, expect, it } from 'vitest';

// See docs/agents/release-bundle-testing.md. An app importing this plugin
// ships its React Native entry -- that much is the app's own choice. What
// must never follow it is the panel, and in a release build none of the
// device instrumentation behind the dev-only `require`s either.
const packageRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');
const reactNativeEntry = path.join(packageRoot, 'dist/react-native/cjs/react-native.js');

describe('@rozenite/zustand-plugin in a release bundle', () => {
  it(
    'ships no panel or instrumentation code when an app imports the plugin',
    async () => {
      const result = await bundleForRelease({
        resolveFrom: packageRoot,
        files: {
          'index.js': `require(${JSON.stringify(reactNativeEntry)});\n`,
        },
      });

      // Keeps the checks below honest: the entry really did get bundled.
      expect(result.rozeniteModules).toContain(
        'packages/zustand-plugin/dist/react-native/cjs/react-native.js',
      );
      expect(result.panelModules).toEqual([]);
      expect(result.rozeniteModules.filter((module) => module.includes('/src/'))).toEqual([]);
    },
    RELEASE_BUNDLE_TIMEOUT,
  );
});
