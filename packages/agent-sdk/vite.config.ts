/// <reference types='vitest' />
import { defineConfig } from 'vite';
import path, { resolve } from 'node:path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/agent-sdk',
  resolve: {
    alias: {
      '@rozenite/controls-plugin/sdk': resolve(
        __dirname,
        '../controls-plugin/sdk.ts',
      ),
      '@rozenite/file-system-plugin/sdk': resolve(
        __dirname,
        '../file-system-plugin/sdk.ts',
      ),
      '@rozenite/mmkv-plugin/sdk': resolve(__dirname, '../mmkv-plugin/sdk.ts'),
      '@rozenite/network-activity-plugin/sdk': resolve(
        __dirname,
        '../network-activity-plugin/sdk.ts',
      ),
      '@rozenite/react-navigation-plugin/sdk': resolve(
        __dirname,
        '../react-navigation-plugin/sdk.ts',
      ),
      '@rozenite/redux-devtools-plugin/sdk': resolve(
        __dirname,
        '../redux-devtools-plugin/sdk.ts',
      ),
      '@rozenite/storage-plugin/sdk': resolve(
        __dirname,
        '../storage-plugin/sdk.ts',
      ),
      '@rozenite/tanstack-query-plugin/sdk': resolve(
        __dirname,
        '../tanstack-query-plugin/sdk.ts',
      ),
    },
  },
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
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        transport: resolve(__dirname, 'src/transport.ts'),
      },
      formats: ['es' as const, 'cjs' as const],
    },
    rollupOptions: {
      external: ['@rozenite/agent-shared'],
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
