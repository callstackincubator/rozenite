/// <reference types='vitest' />
import { defineConfig } from 'vite';
import path, { resolve } from 'node:path';
import dts from 'vite-plugin-dts';
import packageJson from './package.json' with { type: 'json' };

// Builds the rspeedy/Rsbuild plugin entry (`./rspeedy` — `src/rspeedy.ts`
// plus its `src/rspeedy/**` support modules, formerly the whole of
// `@rozenite/lynx-dev`). Unlike `vite.config.ts` (the device-runtime
// build), this is `ssr: true` with every package dependency externalised:
// the plugin runs in the developer's Node process as part of their
// `lynx.config.ts`, not in the app bundle, so it should behave like any
// other Node package build rather than being inlined — and inlining
// `express`/`ws`/`@lynx-js/debug-router-connector` would be actively wrong
// for a couple of them (see `./src/rspeedy/transport/connector.ts` on why
// `@lynx-js/debug-router-connector` in particular must stay a real
// `require()` at call time).
//
// `emptyOutDir: false` is load-bearing: this build runs second (see this
// package's `build` script), and the default `emptyOutDir: true` would
// delete the device-runtime output `vite.config.ts` just produced.
const dependencies = Object.keys(packageJson.dependencies || {});

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/lynx-rspeedy',
  base: './',
  plugins: [
    dts({
      // NOT `rollupTypes: true` here, unlike the original standalone
      // `@rozenite/lynx-dev` config this was adapted from. Verified
      // empirically that it cannot work for a *second* entry sharing one
      // `package.json`: vite-plugin-dts's rollup step picks its single
      // bundled output path from `package.json`'s top-level `types` field
      // (falling back through `typings`/`exports.types`/`exports["."].types`),
      // never from this build's own `lib.entry` — so it targeted
      // `dist/index.d.ts` (this package's `types` field, correct for the
      // *device-runtime* entry) and, finding that file already written by
      // `vite.config.ts`, skipped emitting anything for this entry at all.
      // Emitting un-rolled, per-module declarations (mirroring `src/`, the
      // same shape the device-runtime build above already produces)
      // sidesteps that entirely: `entryRoot: 'src'` naturally lands this
      // entry's output at `dist/rspeedy.d.ts` (importing the rest of
      // `dist/rspeedy/**/*.d.ts` relatively), matching `./rspeedy`'s
      // `dist/rspeedy.js`/`dist/rspeedy.cjs` with no special-casing needed.
      entryRoot: 'src',
      // `tsconfig.lib.json`'s `include` covers the whole of `src/**/*.ts`
      // (both entries share one tsconfig), so this needs its own filter or
      // vite-plugin-dts also walks the device-runtime files, which sit
      // outside this entry's dependency graph but not outside `entryRoot`
      // now that it is `src`.
      include: ['src/rspeedy.ts', 'src/rspeedy/**/*.ts'],
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
  ],
  build: {
    emptyOutDir: false,
    ssr: true,
    lib: {
      entry: resolve(__dirname, 'src/rspeedy.ts'),
      fileName: 'rspeedy',
      formats: ['es' as const, 'cjs' as const],
    },
    rollupOptions: {
      external: dependencies,
    },
  },
  test: {
    passWithNoTests: true,
  },
});
