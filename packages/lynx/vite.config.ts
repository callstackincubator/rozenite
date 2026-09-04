/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import dts from 'vite-plugin-dts';

// Builds the device-runtime entry (`./runtime` — `src/runtime.ts` and
// friends: `install.ts`, `dispatcher.ts`, `lynx-devtool.ts`). This is a
// plain bundled build with no externals: the whole point of this entry is
// that an app can `import '@rozenite/lynx/runtime'` with nothing more to
// install.
//
// It is NOT the `.` export -- that is the seam (`src/index.tsx`), built
// separately by `vite.seam.config.ts` and run first (see this package's
// `build` script) precisely because its default `emptyOutDir: true` must
// not wipe out what this config and `vite.rspeedy.config.ts` produce.
// `emptyOutDir: false` here is load-bearing for the same reason.
//
// `src/rspeedy/**` (the rspeedy/Rsbuild plugin, exported as `./rspeedy`) is
// built separately by `vite.rspeedy.config.ts` — see that file for why it
// needs a different build shape — and is excluded from the `.d.ts` output
// here so this config's declaration files stay limited to the runtime it
// actually builds.
export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/lynx',
  base: './',
  plugins: [
    dts({
      tsconfigPath: './tsconfig.lib.json',
      // `src/__tests__/release-bundle.test.ts` imports `../rspeedy.js`
      // (it exercises `rozeniteLynxPlugin` through a real rspeedy build),
      // which crosses into the excluded `rspeedy.ts`/`rspeedy/**` island
      // below -- vite-plugin-dts's program then refuses to resolve that
      // import, since the file it points to was excluded from this
      // build's file list. Excluding the test file alongside them keeps
      // this build's declarations limited to the device runtime it
      // actually builds, same as the other two exclusions.
      exclude: [
        'src/index.tsx',
        'src/dev-entry.tsx',
        'src/rspeedy.ts',
        'src/rspeedy/**',
        'src/__tests__/release-bundle.test.ts',
      ],
    }),
  ],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/runtime.ts'),
      fileName: 'runtime',
      formats: ['es', 'cjs'],
    },
  },
  test: {
    passWithNoTests: true,
  },
});
