/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      rollupTypes: true,
      tsconfigPath: resolve(__dirname, 'tsconfig.lib.json'),
      bundledPackages: ['birpc'],
    }),
  ],
  root: __dirname,
  cacheDir: '../../node_modules/.vite/devtools-core',
  base: './',
  build: {
    lib: {
      entry: resolve(__dirname, `src/${process.env.VITE_ENTRY_FILE}/index.ts`),
      formats: ['es' as const, 'cjs' as const],
      fileName: (format) =>
        `${process.env.VITE_ENTRY_FILE}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['/callstack/ui/legacy/legacy.js'],
      output: {
        inlineDynamicImports: true,
      },
    },
    emptyOutDir: false,
  },
  server: {
    port: 3000,
    open: true,
  },
});
