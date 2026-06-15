/// <reference types='vitest' />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { rozenitePlugin } from '@rozenite/vite-plugin';

export default defineConfig({
  root: __dirname,
  plugins: [rozenitePlugin()],
  resolve: {
    alias: {
      '@redux-devtools/inspector-monitor-trace-tab': resolve(
        __dirname,
        './src/ui/trace-tab.tsx',
      ),
    },
  },
  test: {
    passWithNoTests: true,
    alias: {
      '@rozenite/agent-shared': resolve(__dirname, '../agent-shared/src/index.ts'),
    },
  },
  base: './',
  build: {
    outDir: './dist',
    emptyOutDir: false,
    reportCompressedSize: false,
    minify: false,
    sourcemap: false,
  },
  server: {
    port: 3000,
    open: true,
  },
});
