# Release bundle testing

Rozenite is a development tool. Whatever a project wires into its bundler
config, a release build must ship none of our code. `@rozenite/test-utils`
provides the bench that proves it, and every plugin owns a Vitest suite in
`src/__tests__/release-bundle.test.ts` that uses it.

These guards belong to plugins. A plugin is what an app installs and what
carries a DevTools panel, so it is where a leak would reach a shipped app.
Bundler packages (`@rozenite/metro`, `@rozenite/web`) are not guarded this
way -- they ship no panel, and the behaviour that matters about them is
already covered by the plugin guards that wire through `withRozenite`.

There are two guard shapes; a plugin may need both.

1. **Panel guard** -- for every plugin an app can import. Bundle an app that
   requires the plugin's React Native entry and assert `panelModules` is
   empty. The plugin's own React Native code is expected in the bundle: an
   app asked for it. Its DevTools panel never is.
2. **Bundler integration guard** -- for plugins exporting `./metro`. Bundle
   with the integration applied and assert `rozeniteModules` is empty.

## The bench

`bundleForRelease()` creates a throwaway app in a temp directory, bundles it
through Metro's JavaScript API with `dev: false`, and reports what ended up
inside:

```ts
import { bundleForRelease, RELEASE_BUNDLE_TIMEOUT } from '@rozenite/test-utils';
import { withRozenite } from '@rozenite/metro';

it(
  'leaves no Rozenite code in a release bundle when disabled',
  async () => {
    const result = await bundleForRelease({
      projectType: 'expo', // or 'react-native' (default)
      resolveFrom: packageRoot,
      configureMetro: (config) =>
        withRozenite(config, { enabled: false, enhanceMetroConfig: withMyPlugin }),
    });

    expect(result.rozeniteModules).toEqual([]);
  },
  RELEASE_BUNDLE_TIMEOUT,
);
```

- `projectType` picks the default config: `@react-native/metro-config`
  (React Native CLI) or `expo/metro-config`.
- `configureMetro` applies the integration under test. It accepts anything
  a Metro config transformer returns, including the function `withRozenite`
  produces.
- `resolveFrom` should be the root of the package under test, so its own
  `@rozenite/*` dependencies resolve from the fixture.
- `files` replaces the fixture's sources when a case needs the app to
  import something.

## The two result fields

- `rozeniteModules` -- every module in the bundle that belongs to Rozenite:
  `node_modules/@rozenite/*` when installed from npm, `packages/*` in this
  repository.
- `panelModules` -- the subset of those that is panel code, recognised by a
  `devtools`, `panel` or `ui` path segment. `@rozenite/ui` counts, since its
  path is `packages/ui`.

## Assert on module paths, not on the bundled source

`result.rozeniteModules` lists the modules Metro put in the bundle that
belong to Rozenite -- `node_modules/@rozenite/*` when installed from npm,
`packages/*` in this repository.

Do not grep `result.code` for `@rozenite`. Injected code frequently carries
no package name: `@rozenite/require-profiler-plugin` adds its polyfill
through `serializer.getPolyfills`, and the resulting bundle contains the
instrumentation without mentioning Rozenite anywhere. A text search passes
while the leak ships. `packages/test-utils/src/metro/__tests__` covers that
case explicitly.

## Keep the guard honest

A test that asserts an empty array passes just as happily when the
integration was never applied at all. Pair it with a case proving the bench
would have seen a leak -- `packages/require-profiler-plugin` asserts that
applying its transformer directly *does* report `setup.js`.

Where a transformer genuinely cannot leak -- one that only appends run
statements for modules already in the graph -- say so in the test rather
than inventing a positive control.

## Integrations that reference files by path

A bundler integration that hands Metro a path on disk must be imported from
its built entry point, not from source. `withRozeniteRequireProfiler` locates
`src/metro/setup.js` by walking up from its own directory, and the number of
levels it walks is fixed by the depth tsc emits the Metro entry point to
(`dist/metro/src/metro/`). Imported from `../index.js`, the same walk starts
two directories higher and lands outside the package, so the bundle fails on
a missing file instead of exercising what ships:

```ts
const require = createRequire(import.meta.url);

const { withRozeniteRequireProfiler } = require(
  path.join(packageRoot, 'dist', 'metro', 'metro.js'),
) as typeof import('../index.js');
```

Transformers that only rewrap config -- `withRozeniteReduxDevTools`,
`withRozeniteExpoAtlasPlugin` -- carry no such path and are imported from
source like any other module under test.

## Plugins that are not app-importable

`@rozenite/expo-atlas-plugin` exports a Metro config transformer from its
`.` entry, not React Native code, so its entry cannot be bundled at all. It
gets the bundler integration guard instead of the panel guard.

## Importing `@rozenite/metro` from a plugin suite

Plugins whose `tsconfig.json` sets `customConditions: ["development"]`
resolve workspace imports to source, so importing `@rozenite/metro` pulls
`@rozenite/middleware` into that package's TypeScript program and its
`typecheck` fails on options the plugin config does not set. Guard the
plugin's own transformer directly in that case, without `withRozenite` --
`packages/redux-devtools-plugin` does exactly that, while
`packages/require-profiler-plugin` can import it and guards the wired
`enabled: false` path.

## Running it

The suites run as each package's `test` script, so
`pnpm turbo run test --affected` in CI covers them. They read built output,
which the `test` task's `dependsOn: ["^build", "build"]` guarantees.

A cold Metro build takes a few seconds; always pass `RELEASE_BUNDLE_TIMEOUT`
as the Vitest timeout.

## What it does not cover

`isBundling()` in `packages/metro/src/is-bundling.ts` sniffs `process.argv`
to detect `react-native bundle` / `expo export`. The bench drives Metro
directly, so it cannot exercise that path; it is covered by unit tests
instead.
