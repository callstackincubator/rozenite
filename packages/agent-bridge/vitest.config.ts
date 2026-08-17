/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/agent-bridge',
  test: {
    passWithNoTests: true,
  },
});
