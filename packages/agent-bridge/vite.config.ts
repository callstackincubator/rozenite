/// <reference types='vitest' />
import { defineConfig } from 'vite';
import path, { resolve } from 'node:path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/agent-bridge',
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
      external: ['react', '@rozenite/plugin-bridge'],
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
