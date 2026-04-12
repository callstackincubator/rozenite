/// <reference types='vitest' />
import path from 'node:path';
import { defineConfig } from 'vite';
import { rozenitePlugin } from '@rozenite/vite-plugin';

/** Second entry for `@rozenite/sqlite-plugin/internals` without touching the shared vite RN preset. */
const sqliteInternalsSubpathPlugin = {
  name: 'sqlite-plugin-internals-subpath',
  enforce: 'post' as const,
  config(config: import('vite').UserConfig) {
    const root = __dirname;
    config.build ??= {};
    config.build.lib = {
      ...config.build.lib,
      entry: {
        index: path.resolve(root, 'react-native.ts'),
        internals: path.resolve(root, 'src/react-native/internals.ts'),
      },
      fileName: (format: string, entryName: string) => {
        const ext = format === 'es' ? 'js' : 'cjs';
        return `react-native/${entryName}.${ext}`;
      },
    };
    config.build.rollupOptions ??= {};
    config.build.rollupOptions.output = [
      {
        format: 'es',
        exports: 'named' as const,
        interop: 'auto' as const,
        entryFileNames: 'react-native/[name].js',
        chunkFileNames: 'react-native/chunks/[name].js',
      },
      {
        format: 'cjs',
        exports: 'named' as const,
        interop: 'auto' as const,
        entryFileNames: 'react-native/[name].cjs',
        chunkFileNames: 'react-native/chunks/[name].cjs',
      },
    ];
  },
};

export default defineConfig({
  root: __dirname,
  plugins: [rozenitePlugin(), sqliteInternalsSubpathPlugin],
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
