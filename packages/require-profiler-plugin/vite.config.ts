/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { rozenitePlugin } from '@rozenite/vite-plugin';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig({
  root: __dirname,
  plugins: [rozenitePlugin()],
  base: './',
  build: {
    outDir: './dist',
    emptyOutDir: false,
    reportCompressedSize: false,
    minify: true,
    sourcemap: false,
    rollupOptions: {
      plugins: [
        {
          name: 'copy-files',
          writeBundle() {
            fs.cpSync(
              path.resolve(__dirname, 'src/metro/setup.js'),
              path.resolve(__dirname, 'dist/setup.js'),
            );
          },
        },
      ],
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
