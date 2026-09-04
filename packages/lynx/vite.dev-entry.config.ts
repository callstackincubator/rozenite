/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import dts from 'vite-plugin-dts';

// Builds the shipped noop (`src/dev-entry.tsx`) as its own, genuinely
// separate Rollup output -- deliberately NOT a second entry in
// `vite.seam.config.ts`'s build, even though that would also produce a
// `dist/dev-entry.js`. See `src/index.tsx`'s comment on its `./dev-entry.js`
// import for why: `vite.seam.config.ts` marks that import `external`
// specifically so Rollup treats it as a dependency it does not control
// (real interop, checked at runtime) rather than a same-build reference it
// can statically optimize away (wrong once `RozeniteResolverPlugin`
// redirects the request elsewhere). That only works if this file is a
// separate build Rollup has no visibility into while bundling the seam.
//
// `emptyOutDir: false`: this runs after `vite.seam.config.ts` in this
// package's `build` script, and must not wipe out `dist/index.js`.
export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/lynx-dev-entry',
  base: './',
  plugins: [
    dts({
      entryRoot: 'src',
      include: ['src/dev-entry.tsx'],
      tsconfigPath: './tsconfig.lib.json',
    }),
  ],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/dev-entry.tsx'),
      fileName: 'dev-entry',
      formats: ['es', 'cjs'],
    },
  },
  test: {
    passWithNoTests: true,
  },
});
