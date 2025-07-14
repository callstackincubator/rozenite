/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      tsconfigPath: './tsconfig.lib.json',
    }),
  ],
  root: __dirname,
  cacheDir: '../../node_modules/.vite/communication',
  base: './',
  build: {
    lib: {
      entry: {
        browser: resolve(__dirname, 'src/browser.ts'),
        node: resolve(__dirname, 'src/node.ts'),
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['react'],
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
