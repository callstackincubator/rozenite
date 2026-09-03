import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleLynxForRelease, RELEASE_BUNDLE_TIMEOUT } from '@rozenite/test-utils';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { describe, expect, it } from 'vitest';
import { rozeniteLynxPlugin, type RozeniteLynxOptions } from '../rspeedy.js';

const packageRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');

// The rspeedy/rspack equivalent of `packages/metro/src/__tests__/release-bundle.test.ts`,
// per docs/agents/release-bundle-testing.md: the resolver's own decision
// table, exercised through a real rspeedy release build rather than through
// unit tests of `RozeniteResolverPlugin` alone. Its shared logic already
// has unit coverage in `@rozenite/middleware`'s `production-guard.test.ts`;
// what belongs here is proof that `rozeniteLynxPlugin` actually wires that
// logic into a real `rspeedy build`.
//
// `enableDesktop`/`enableAndroid`/`enableIOS` are turned off in every case
// below: the guard runs unconditionally regardless of `enabled`, but
// leaving device discovery on would make every bundle in this suite spend
// time scanning for USB/localhost DebugRouter targets it will never find.
const bundle = (files: Record<string, string>, options?: RozeniteLynxOptions) =>
  bundleLynxForRelease({
    files,
    resolveFrom: packageRoot,
    plugins: [
      ...pluginReactLynx(),
      rozeniteLynxPlugin({
        enableAndroid: false,
        enableIOS: false,
        enableDesktop: false,
        ...options,
      }),
    ],
  });

describe('rozeniteLynxPlugin in a release bundle', () => {
  it(
    'fails when an app imports a Rozenite plugin directly, naming the importing file',
    async () => {
      const importingFile = path.join('src', 'App.js');

      await expect(
        bundle({
          'src/index.js': "require('./App.js');\n",
          [importingFile]:
            "import { useRozeniteControlsPlugin } from '@rozenite/controls-plugin';\nuseRozeniteControlsPlugin;\n",
        }),
      ).rejects.toThrow(new RegExp(importingFile.replace(/[/\\]/g, '.')));
    },
    RELEASE_BUNDLE_TIMEOUT,
  );

  it(
    'fails when an app imports a plugin that does not declare Lynx support, naming the integrations it does declare',
    async () => {
      const importingFile = path.join('src', 'App.js');

      // `@rozenite/storage-plugin` declares `integrations: ['react-native']`
      // only (see `packages/storage-plugin/rozenite.config.ts`) -- a real
      // React-Native-only plugin, not a fixture stand-in.
      await expect(
        bundle({
          'src/index.js': "require('./App.js');\n",
          [importingFile]:
            "import { useRozeniteStoragePlugin } from '@rozenite/storage-plugin';\nuseRozeniteStoragePlugin;\n",
        }),
      ).rejects.toThrow(/does not declare "lynx" support/);
    },
    RELEASE_BUNDLE_TIMEOUT,
  );

  it(
    'succeeds when an app imports a declared production entry',
    async () => {
      const result = await bundle({
        'src/index.js':
          "require('@rozenite/feature-flags-plugin/register');\nconsole.log('rozenite release bundle fixture');\n",
      });

      // Non-vacuous: the declared entry really did get bundled, and
      // nothing beyond it -- no panel code -- came along with it.
      expect(
        result.rozeniteModules.some((modulePath) =>
          /feature-flags-plugin\/dist\/react-native\/(cjs\/)?register\.js$/.test(modulePath),
        ),
      ).toBe(true);
      expect(result.panelModules).toEqual([]);
    },
    RELEASE_BUNDLE_TIMEOUT,
  );

  it(
    'still fails the violating import when rozeniteLynxPlugin is disabled',
    async () => {
      const importingFile = path.join('src', 'App.js');

      await expect(
        bundle(
          {
            'src/index.js': "require('./App.js');\n",
            [importingFile]:
              "import { useRozeniteControlsPlugin } from '@rozenite/controls-plugin';\nuseRozeniteControlsPlugin;\n",
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
      const importingFile = path.join('src', 'App.js');

      const result = await bundle(
        {
          'src/index.js': "require('./App.js');\n",
          [importingFile]:
            "import { useRozeniteControlsPlugin } from '@rozenite/controls-plugin';\nuseRozeniteControlsPlugin;\n",
        },
        { allowInProduction: ['@rozenite/controls-plugin'] },
      );

      expect(result.rozeniteModules.length).toBeGreaterThan(0);
    },
    RELEASE_BUNDLE_TIMEOUT,
  );

  it(
    'ships zero Rozenite modules for a clean app with no plugin imports',
    async () => {
      const result = await bundle({
        'src/index.js': "console.log('rozenite release bundle fixture');\n",
      });

      expect(result.rozeniteModules).toEqual([]);
    },
    RELEASE_BUNDLE_TIMEOUT,
  );
});
