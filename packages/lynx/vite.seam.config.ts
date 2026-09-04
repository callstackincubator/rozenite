/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import dts from 'vite-plugin-dts';

// Builds the app-side seam (`.` — `src/index.tsx`), mirroring
// `@rozenite/react-native`'s tsc-built seam but through this package's
// existing Vite/Rollup pipeline instead of a fourth build tool.
//
// Three things make this build shape different from `vite.config.ts` (the
// device-runtime build) and `vite.rspeedy.config.ts` (the Node-side
// plugin):
//
// - JSX is compiled against `@lynx-js/react`, not `react`: ReactLynx is its
//   own implementation of the React runtime (it does not depend on the
//   `react` package at all), so a JSX pragma built for plain `react` would
//   emit an import that has nothing to do with what actually renders a
//   Lynx app. `apps/playground-lynx/src/tsconfig.json` sets the same
//   `jsx: 'react-jsx'` / `jsxImportSource: '@lynx-js/react'` pair for
//   hand-written app source; this build has to bake the same choice in at
//   publish time, because the seam ships prebuilt and no bundler transform
//   runs over `node_modules` to do it later.
// - `@lynx-js/react` is external (a peer dependency, declared in
//   `package.json`), not bundled: the emitted `@lynx-js/react/jsx-runtime`
//   import must resolve to the *app's* copy so the seam's `<DevEntry />`
//   is a real element in the app's own React tree, not a second, unrelated
//   instance of the runtime.
// - `./dev-entry.js` is ALSO external, deliberately not a second entry
//   sharing this build (that was tried and reverted -- see below). It is
//   built separately by `vite.dev-entry.config.ts` and referenced here
//   only as a plain, externally-resolved specifier.
//
//   Why not a second entry in this same config, the more obvious way to
//   get a real, separately-resolvable `dist/dev-entry.js`: `src/index.tsx`
//   imports it, and `RozeniteResolverPlugin` (`@rozenite/middleware`)
//   rewrites that exact `./dev-entry.js` request to a *different* module --
//   the app's own `rozenite.dev.tsx` -- at resolve time, which Rollup has
//   no way to know while bundling. Two same-build-entry shapes were tried
//   and both broke the redirect:
//     1. `import DevEntry from './dev-entry.js'` (a same-build default
//        import): Rollup's CJS output statically inlines a direct,
//        un-interop'd reference to whatever shape it knows *this build's
//        own* `dev-entry.tsx` has (a bare `module.exports = fn`, since it
//        controls both sides). That reference is wrong once resolved
//        elsewhere: a real ES module compiled independently by
//        rspack/webpack wraps a default export as
//        `{ default: fn, __esModule: true }`, and the CJS build ends up
//        rendering that namespace object as the component instead of the
//        function inside it.
//     2. `import * as DevEntryModule from './dev-entry.js'` plus a
//        hand-written runtime unwrap: this defeats Rollup's static
//        optimization, but a namespace import of a same-build entry makes
//        Rollup hoist the entry's contents into a *third*, hash-named
//        shared chunk (`dev-entry-<hash>.js`) that both `dist/index.js`
//        and `dist/dev-entry.js` import from -- so `dist/index.js` no
//        longer requests the literal `./dev-entry.js` string
//        `isSeamDevEntryRequest` (`@rozenite/middleware`'s
//        `production-guard.ts`) matches on at all, and the redirect never
//        fires, in development or production.
//   Marking it `external` sidesteps both: Rollup treats the reference the
//   way it treats any dependency it does not control, with a real runtime
//   `__esModule` check before deciding whether to unwrap `.default` (correct
//   for either shape), and the import specifier is left untouched in every
//   output format -- verified empirically: the CJS build's `require()` call
//   uses the literal `./dev-entry.js` string, not a `.cjs`-rewritten one,
//   because external requests are never extension-rewritten the way a
//   same-build chunk reference is.
//
// Runs first in this package's `build` script (`vite build --config
// vite.seam.config.ts && vite build --config vite.dev-entry.config.ts &&
// vite build && vite build --config vite.rspeedy.config.ts`), before the
// three `emptyOutDir: false` builds that produce `dist/dev-entry.*`,
// `dist/runtime.*` and `dist/rspeedy.*`.
export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/lynx-seam',
  base: './',
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@lynx-js/react',
  },
  plugins: [
    dts({
      entryRoot: 'src',
      // `dev-entry.tsx` is included for type resolution only -- `index.tsx`
      // imports it (for its type), even though `rollupOptions.external`
      // below excludes it from bundling. `rollupTypes`/`include` here
      // governs the TS program vite-plugin-dts builds, a separate concern
      // from what Rollup bundles; without it, resolving `./dev-entry.js`'s
      // type hits the same "file not listed in the program" error `vite.
      // config.ts`'s `exclude` list works around from the other direction.
      include: ['src/index.tsx', 'src/dev-entry.tsx'],
      tsconfigPath: './tsconfig.lib.json',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
    },
    rollupOptions: {
      external: [/^@lynx-js\/react/, './dev-entry.js'],
      // An explicit per-format `output` array (Vite ignores `lib.formats`
      // once this is an array) rather than `lib.fileName`/`lib.formats`:
      // this package's other builds put both formats' output in one flat
      // `dist/` directory, distinguished only by extension (`.js` for ESM,
      // `.cjs` for CJS) rather than by separate `esm/`/`cjs/` directories
      // with their own `package.json` `"type"` marker the way
      // `@rozenite/react-native`'s tsc build does. That means an external
      // request emitted verbatim (Rollup's default for `external`) is
      // wrong for the CJS output specifically: `require('./dev-entry.js')`
      // would load `dist/dev-entry.js`, which is genuine ESM syntax (`export
      // default`) and cannot be `require()`d. `paths` below remaps the
      // external `./dev-entry.js` id to `./dev-entry.cjs` in the CJS
      // output only, so each format's `require`/`import` points at the
      // sibling file that is actually loadable as that format.
      output: [
        { format: 'es', entryFileNames: 'index.js' },
        {
          format: 'cjs',
          entryFileNames: 'index.cjs',
          exports: 'default',
          // `id` here is the *resolved* external id (an absolute path, not
          // the literal `'./dev-entry.js'` written in source) -- verified
          // empirically: comparing against the literal specifier never
          // matched, and the returned path is used as the `require()`
          // string as-is, so it must be the bare relative form, not a
          // full path.
          paths: (id) => (id.endsWith('/dev-entry.js') ? './dev-entry.cjs' : id),
          // Rollup's default `interop` ("default") assumes an external
          // `require()`'s result *is* the default export and accesses it
          // directly, with no `.default` unwrap at all -- verified
          // empirically (the emitted code used the required value as-is).
          // That is wrong here for the same reason a plain default import
          // was wrong for a same-build reference: whichever module
          // `./dev-entry.cjs` actually resolves to at runtime may be this
          // package's own noop (a bare `module.exports = fn`, no
          // `.default`) or the app's `rozenite.dev.tsx`, redirected there
          // by `RozeniteResolverPlugin` and compiled independently by
          // rspack/webpack (`{ default: fn, __esModule: true }`). `'auto'`
          // is the one interop mode that checks `__esModule` at runtime
          // and unwraps `.default` only when it is actually set, which is
          // correct for both shapes.
          interop: 'auto',
        },
      ],
    },
  },
  test: {
    passWithNoTests: true,
  },
});
