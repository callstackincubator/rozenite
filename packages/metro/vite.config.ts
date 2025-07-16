/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/metro',
  base: './',
  build: {
    ssr: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es' as const, 'cjs' as const],
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
