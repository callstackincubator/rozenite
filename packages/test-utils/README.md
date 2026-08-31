# @rozenite/test-utils

Internal testing utilities shared by Rozenite packages. Private -- never
published.

## `bundleForRelease()`

Bundles a throwaway app through Metro's JavaScript API in release mode and
reports which modules ended up inside, so a package can prove its bundler
integration ships no Rozenite code.

```ts
import { bundleForRelease, RELEASE_BUNDLE_TIMEOUT } from '@rozenite/test-utils';

const result = await bundleForRelease({
  projectType: 'react-native',
  resolveFrom: packageRoot,
  configureMetro: (config) => withRozenite(config, { enabled: false }),
});

expect(result.rozeniteModules).toEqual([]);
```

See `docs/agents/release-bundle-testing.md` for the full guide, including
why assertions go on `rozeniteModules` rather than on the bundled source.
