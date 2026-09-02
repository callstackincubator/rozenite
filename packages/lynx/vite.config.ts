/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import dts from 'vite-plugin-dts';

// Builds the device-runtime entry (`.` — `src/index.ts` and friends). This
// is a plain bundled build with no externals: the whole point of `.` is
// that an app can `import '@rozenite/lynx'` with nothing more to install.
//
// `src/rspeedy/**` (the rspeedy/Rsbuild plugin, exported as `./rspeedy`) is
// built separately by `vite.rspeedy.config.ts` — see that file for why it
// needs a different build shape — and is excluded from the `.d.ts` output
// here so this config's declaration files stay limited to the runtime it
// actually builds. Both configs are invoked from this package's single
// `build` script (`vite build && vite build --config vite.rspeedy.config.ts`).
export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/lynx',
  base: './',
  plugins: [
    dts({
      tsconfigPath: './tsconfig.lib.json',
      exclude: ['src/rspeedy.ts', 'src/rspeedy/**'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      fileName: 'index',
      formats: ['es', 'cjs'],
    },
  },
  test: {
    passWithNoTests: true,
  },
});
