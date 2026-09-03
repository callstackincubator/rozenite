/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import dts from 'vite-plugin-dts';

// Builds the app-side seam (`.` — `src/index.tsx` and `src/dev-entry.tsx`),
// mirroring `@rozenite/react-native`'s tsc-built seam but through this
// package's existing Vite/Rollup pipeline instead of a fourth build tool.
//
// Two things make this build shape different from `vite.config.ts` (the
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
// - `src/dev-entry.tsx` is a second entry point, not a module `index.tsx`
//   pulls in -- a single-entry Rollup build inlines a same-package relative
//   import, which would erase the `./dev-entry.js` request entirely and
//   give `RozeniteResolverPlugin`'s dev-entry redirect (which matches on
//   that exact request, see `isSeamDevEntryRequest` in
//   `@rozenite/middleware`'s `production-guard.ts`) nothing to intercept.
//   Declaring it as its own entry keeps Rollup from merging it into
//   `index.js`: entry modules are always emitted as their own chunk, so
//   `index.js` ends up with a real `import DevEntry from './dev-entry.js'`
//   pointing at a real, separately-built `dist/dev-entry.js` -- exactly the
//   two-file shape `@rozenite/react-native`'s unbundled tsc build produces
//   for free.
//
// Runs first in this package's `build` script (`vite build --config
// vite.seam.config.ts && vite build && vite build --config
// vite.rspeedy.config.ts`), before the default `emptyOutDir: true` build
// (`vite.config.ts`) and the rspeedy build -- both of which set
// `emptyOutDir: false` so they don't wipe what this one just wrote.
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
      include: ['src/index.tsx', 'src/dev-entry.tsx'],
      tsconfigPath: './tsconfig.lib.json',
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.tsx'),
        'dev-entry': resolve(__dirname, 'src/dev-entry.tsx'),
      },
      // A plain string `fileName` (as `vite.config.ts`/`vite.rspeedy.config.ts`
      // use) only applies to a single-entry build; with two entries above,
      // it must be this function form so both land at `dist/<name>.js` /
      // `dist/<name>.cjs` instead of Vite's multi-entry default of
      // `dist/<name>.<format>.js`.
      fileName: (format, entryName) => (format === 'cjs' ? `${entryName}.cjs` : `${entryName}.js`),
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [/^@lynx-js\/react/],
    },
  },
  test: {
    passWithNoTests: true,
  },
});
