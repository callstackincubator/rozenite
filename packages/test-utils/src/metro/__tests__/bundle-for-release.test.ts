import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bundleForRelease } from '../bundle-for-release.js';
import { RELEASE_BUNDLE_TIMEOUT } from '../../index.js';

const leakingModulePath = path.resolve(
  fileURLToPath(import.meta.url),
  '../../__fixtures__/leaking-module.js',
);

const panelModulePath = path.resolve(
  fileURLToPath(import.meta.url),
  '../../__fixtures__/ui/panel-module.js',
);

describe('bundleForRelease', () => {
  it(
    'reports no Rozenite modules for an app that uses none',
    async () => {
      const bundle = await bundleForRelease();

      expect(bundle.rozeniteModules).toEqual([]);
      expect(bundle.modules.length).toBeGreaterThan(0);
      expect(bundle.code).toContain('rozenite release bundle fixture');
    },
    RELEASE_BUNDLE_TIMEOUT,
  );

  it(
    'detects a Rozenite module reached through an import',
    async () => {
      const bundle = await bundleForRelease({
        files: {
          'index.js': `require(${JSON.stringify(leakingModulePath)});\n`,
        },
      });

      expect(bundle.rozeniteModules).toEqual([
        'packages/test-utils/src/metro/__fixtures__/leaking-module.js',
      ]);
    },
    RELEASE_BUNDLE_TIMEOUT,
  );

  it(
    'detects a Rozenite module injected as a polyfill, which the bundled source does not name',
    async () => {
      const bundle = await bundleForRelease({
        configureMetro: (config) => ({
          ...config,
          serializer: {
            ...config.serializer,
            getPolyfills: () => [leakingModulePath],
          },
        }),
      });

      expect(bundle.rozeniteModules).toEqual([
        'packages/test-utils/src/metro/__fixtures__/leaking-module.js',
      ]);
      // The reason this bench asserts on module paths: the leaked code is
      // in the bundle, yet nothing in the output mentions Rozenite.
      expect(bundle.code).not.toContain('@rozenite/');
    },
    RELEASE_BUNDLE_TIMEOUT,
  );

  it(
    'bundles through the Expo default config as well',
    async () => {
      const bundle = await bundleForRelease({ projectType: 'expo' });

      expect(bundle.rozeniteModules).toEqual([]);
    },
    RELEASE_BUNDLE_TIMEOUT,
  );

  it(
    'separates panel modules from the rest of the Rozenite code it finds',
    async () => {
      const bundle = await bundleForRelease({
        files: {
          'index.js': `require(${JSON.stringify(leakingModulePath)});\nrequire(${JSON.stringify(panelModulePath)});\n`,
        },
      });

      expect(bundle.panelModules).toEqual([
        'packages/test-utils/src/metro/__fixtures__/ui/panel-module.js',
      ]);
      expect(bundle.rozeniteModules).toHaveLength(2);
    },
    RELEASE_BUNDLE_TIMEOUT,
  );

  it(
    'reports no panel modules when only React Native code is bundled',
    async () => {
      const bundle = await bundleForRelease({
        files: {
          'index.js': `require(${JSON.stringify(leakingModulePath)});\n`,
        },
      });

      expect(bundle.panelModules).toEqual([]);
    },
    RELEASE_BUNDLE_TIMEOUT,
  );
});
