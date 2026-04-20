/// <reference types='vitest' />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { rozenitePlugin } from '@rozenite/vite-plugin';

export default defineConfig({
  root: __dirname,
  plugins: [rozenitePlugin()],
  test: {
    alias: {
      '@rozenite/agent-shared': resolve(__dirname, '../agent-shared/src/index.ts'),
    },
  },
  base: './',
  build: {
    outDir: './dist',
    emptyOutDir: false,
    reportCompressedSize: false,
    minify: true,
    sourcemap: false,
  },
  server: {
    port: 3000,
    open: true,
  },
});
