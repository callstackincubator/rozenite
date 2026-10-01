import { defineConfig } from 'vitest/config';

/**
 * Node-only tests for the harness pieces that run without a device (the
 * fixture server and the normaliser). This is the playground's `test` script.
 */
export default defineConfig({
  root: __dirname,
  test: {
    include: ['*.test.ts'],
    exclude: ['*.e2e.test.ts'],
    environment: 'node',
  },
});
