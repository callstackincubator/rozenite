/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import path, { resolve } from 'node:path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/middleware',
  base: './',
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
      rollupTypes: true,
    }),
  ],
  build: {
    ssr: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es' as const, 'cjs' as const],
    },
  },
  test: {
    passWithNoTests: true,
    // Benchmark files run only on demand (see their header comment), not
    // as part of the regular suite.
    exclude: [...configDefaults.exclude, '**/*.bench.test.ts'],
  },
  server: {
    port: 3000,
    open: true,
  },
});
