import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleForRelease, RELEASE_BUNDLE_TIMEOUT, type MetroConfig } from '@rozenite/test-utils';
import { describe, expect, it } from 'vitest';
import { withRozenite } from '../index.js';

// This is the bundler-integration guard for `withRozenite` itself, per
// docs/agents/release-bundle-testing.md. Plugin suites guard their own
// `enabled` handling directly, without `withRozenite` (importing
// `@rozenite/metro` from a plugin's `development`-conditioned tsconfig pulls
// `@rozenite/middleware`'s sources into that package's TypeScript program).
// What belongs here is the resolver's own decision table, exercised through
// a real Metro release build rather than through unit tests of
// `applyProductionGuard` alone.
const packageRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');

const bundle = (files: Record<string, string>, options?: Parameters<typeof withRozenite>[1]) =>
  bundleForRelease({
    resolveFrom: packageRoot,
    files,
    // `withRozenite` returns a thunk (`() => Promise<T>`); calling it here
    // yields a plain `Promise<MetroConfig>`. The cast below is only needed
    // because `T` is inferred from `@rozenite/test-utils`'s own `MetroConfig`
    // type alias, which structurally differs just enough (optional vs.
    // required `cacheVersion`) from `withRozenite`'s generic bound to trip
    // TypeScript -- both describe the same real Metro config at runtime.
    configureMetro: async (config): Promise<MetroConfig> =>
      (await withRozenite(config, options)()) as unknown as MetroConfig,
  });

describe('withRozenite in a release bundle', () => {
  it(
    'fails when an app imports a Rozenite plugin directly, naming the importing file',
    async () => {
      const importingFile = path.join('src', 'app', 'screens', 'HomeScreen.tsx');

      await expect(
        bundle({
          'index.js': "require('./src/app/screens/HomeScreen.tsx');\n",
          [importingFile]:
            "import { useRozeniteStoragePlugin } from '@rozenite/storage-plugin';\nuseRozeniteStoragePlugin;\n",
        }),
      ).rejects.toThrow(new RegExp(importingFile.replace(/[/\\]/g, '.')));
    },
    RELEASE_BUNDLE_TIMEOUT,
  );

  it(
    'succeeds when an app imports a declared production entry',
    async () => {
      const result = await bundle({
        'index.js':
          "require('@rozenite/rhf-plugin/register');\nconsole.log('rozenite release bundle fixture');\n",
      });

      // Non-vacuous: the declared entry really did get bundled (either the
      // ESM or the CJS build, whichever Metro's resolver conditions pick),
      // and nothing beyond it -- no panel code -- came along with it.
      expect(
        result.rozeniteModules.some((modulePath) =>
          /rhf-plugin\/dist\/react-native\/(cjs\/)?register\.js$/.test(modulePath),
        ),
      ).toBe(true);
      expect(result.panelModules).toEqual([]);
    },
    RELEASE_BUNDLE_TIMEOUT,
  );

  it(
    'still fails the violating import when withRozenite is disabled',
    async () => {
      const importingFile = path.join('src', 'app', 'screens', 'HomeScreen.tsx');

      await expect(
        bundle(
          {
            'index.js': "require('./src/app/screens/HomeScreen.tsx');\n",
            [importingFile]:
              "import { useRozeniteStoragePlugin } from '@rozenite/storage-plugin';\nuseRozeniteStoragePlugin;\n",
          },
          { enabled: false },
        ),
      ).rejects.toThrow(new RegExp(importingFile.replace(/[/\\]/g, '.')));
    },
    RELEASE_BUNDLE_TIMEOUT,
  );

  it(
    'lets an undeclared import through when the plugin is listed in allowInProduction',
    async () => {
      const importingFile = path.join('src', 'app', 'screens', 'HomeScreen.tsx');

      const result = await bundle(
        {
          'index.js': "require('./src/app/screens/HomeScreen.tsx');\n",
          [importingFile]:
            "import { useRozeniteStoragePlugin } from '@rozenite/storage-plugin';\nuseRozeniteStoragePlugin;\n",
        },
        { allowInProduction: ['@rozenite/storage-plugin'] },
      );

      expect(result.rozeniteModules.length).toBeGreaterThan(0);
    },
    RELEASE_BUNDLE_TIMEOUT,
  );
});
