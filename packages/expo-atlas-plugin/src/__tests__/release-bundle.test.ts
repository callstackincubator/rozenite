import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleForRelease, RELEASE_BUNDLE_TIMEOUT } from '@rozenite/test-utils';
import { describe, expect, it } from 'vitest';
import { withRozeniteExpoAtlasPlugin } from '../with-expo-atlas.js';

// Unlike the other plugins, this one's entry point is a Metro config
// transformer running in Node, not React Native code an app imports -- so
// the guard is on what the transformer leaves in a bundle. It swaps in a
// custom serializer, which is precisely the seam where bundle contents can
// change. See docs/agents/release-bundle-testing.md.
const packageRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');

describe('withRozeniteExpoAtlasPlugin', () => {
  it(
    'leaves no Rozenite code in a release bundle',
    async () => {
      const result = await bundleForRelease({
        projectType: 'expo',
        resolveFrom: packageRoot,
        configureMetro: (config) => withRozeniteExpoAtlasPlugin(config),
      });

      expect(result.rozeniteModules).toEqual([]);
      expect(result.panelModules).toEqual([]);
    },
    RELEASE_BUNDLE_TIMEOUT,
  );
});
