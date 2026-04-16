/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/cli',
  resolve: {
    alias: [
      {
        find: '@rozenite/agent-sdk/transport',
        replacement: resolve(
          __dirname,
          '../agent-sdk/src/transport.ts',
        ),
      },
      {
        find: /^@rozenite\/agent-sdk$/,
        replacement: resolve(__dirname, '../agent-sdk/src/index.ts'),
      },
    ],
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    ssr: true,
    lib: {
      entry: 'src/index.ts',
      fileName: 'index',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: [],
    },
  },
}));
