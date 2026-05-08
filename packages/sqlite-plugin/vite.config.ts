/// <reference types='vitest' />
import path from 'node:path';
import { defineConfig } from 'vite';
import { rozenitePlugin } from '@rozenite/vite-plugin';

const sqliteAdapterHelpersSubpathPlugin = {
  name: 'sqlite-plugin-adapter-helpers-subpath',
  enforce: 'post' as const,
  config(config: import('vite').UserConfig) {
    const root = __dirname;
    config.build ??= {};
    const currentEntry = config.build.lib?.entry;
    const normalizedEntry =
      typeof currentEntry === 'string'
        ? { index: currentEntry }
        : (currentEntry ?? {});

    config.build.lib = {
      ...config.build.lib,
      entry: {
        ...normalizedEntry,
        'adapter-helpers': path.resolve(
          root,
          'src/react-native/adapter-helpers.ts',
        ),
      },
    };
    config.build.rollupOptions ??= {};
    const currentOutput = config.build.rollupOptions.output;
    const applyEntryNaming = (output: import('rollup').OutputOptions) => ({
      ...output,
      entryFileNames:
        output.format === 'cjs'
          ? 'react-native/[name].cjs'
          : 'react-native/[name].js',
    });

    if (Array.isArray(currentOutput)) {
      config.build.rollupOptions.output = currentOutput.map(applyEntryNaming);
    } else if (currentOutput) {
      config.build.rollupOptions.output = applyEntryNaming(currentOutput);
    }
  },
};

export default defineConfig({
  root: __dirname,
  plugins: [rozenitePlugin(), sqliteAdapterHelpersSubpathPlugin],
  test: {
    passWithNoTests: true,
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
