/// <reference types='vitest' />
import { defineConfig } from 'vite';
import path, { resolve } from 'node:path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/tools',
  base: './',
  test: {
    passWithNoTests: true,
    environment: 'node',
  },
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
      // Kept rolled up: without it the emitted declarations reference
      // sibling files by path, and a consumer re-exporting an inferred type
      // from this package can no longer name it (TS2742, hit by
      // `@rozenite/expo-atlas-plugin`). Each entry gets its own
      // self-contained bundle, so the browser-facing `./integration` subpath
      // still ships types free of this package's Node-only declarations.
      rollupTypes: true,
    }),
  ],
  build: {
    ssr: true,
    lib: {
      // `integration` is a second entry, not part of the index bundle, so
      // the browser-side DevTools hosts can import the shared integration
      // vocabulary without pulling this package's Node-only modules (fs,
      // module resolution, the Metro config transformer) into a browser
      // bundle. Its source module has no imports for exactly that reason.
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        integration: resolve(__dirname, 'src/integration.ts'),
      },
      formats: ['es' as const, 'cjs' as const],
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
