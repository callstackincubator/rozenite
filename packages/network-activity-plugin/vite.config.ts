/// <reference types='vitest' />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { rozenitePlugin } from '@rozenite/vite-plugin';

export default defineConfig({
  root: __dirname,
  plugins: [rozenitePlugin()],
  test: {
    passWithNoTests: true,
    setupFiles: ['./vitest.setup.ts'],
    alias: {
      '@rozenite/agent-shared': resolve(
        __dirname,
        '../agent-shared/src/index.ts',
      ),
    },
  },
  base: './',
  build: {
    outDir: './dist',
    emptyOutDir: false,
    reportCompressedSize: false,
    minify: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Mitigate https://github.com/facebook/metro/issues/836
          if (id.includes('event-source.ts')) {
            return 'event-source';
          }

          if (id.includes('get-nitro-module.ts')) {
            return 'get-nitro-module';
          }

          return undefined;
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
