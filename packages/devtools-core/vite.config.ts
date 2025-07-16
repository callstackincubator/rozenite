/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      rollupTypes: true,
      tsconfigPath: resolve(__dirname, 'tsconfig.lib.json'),
    }),
  ],
  root: __dirname,
  cacheDir: '../../node_modules/.vite/devtools-core',
  base: './',
  build: {
    lib: {
      entry: resolve(__dirname, 'src/host/index.ts'),
      formats: ['es' as const, 'cjs' as const],
      fileName: (format) => `host.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: [
        '/callstack/ui/legacy/legacy.js',
        '/callstack/core/sdk/sdk.js',
        '/callstack/models/react_native/react_native.js',
      ],
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
