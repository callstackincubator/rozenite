/// <reference types='vitest' />
import { defineConfig } from 'vite';
import path, { resolve } from 'node:path';
import dts from 'vite-plugin-dts';
import packageJson from './package.json' assert { type: 'json' };

const dependencies = Object.keys(packageJson.dependencies || {});

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/repack',
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
    rollupOptions: {
      external: dependencies,
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
