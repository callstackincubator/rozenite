/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { rozenitePlugin } from '@rozenite/vite-plugin';

/** Tests that run a real zustand store; they run again against zustand 4.4. */
const ZUSTAND_4_TESTS = [
  'src/zustand/__tests__/middleware.test.ts',
  'src/runtime/__tests__/agent-tools.test.ts',
  'src/__tests__/protocol-fake-pair.test.ts',
];

export default defineConfig({
  root: __dirname,
  plugins: [rozenitePlugin()],
  test: {
    passWithNoTests: true,
    projects: [
      { extends: true, test: { name: 'zustand-5' } },
      {
        // The oldest zustand in the peer range: same tests, older runtime.
        extends: true,
        test: { name: 'zustand-4.4', include: ZUSTAND_4_TESTS },
        resolve: { alias: [{ find: /^zustand(\/.*)?$/, replacement: 'zustand-v4$1' }] },
      },
    ],
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
