/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/agent-bridge',
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    passWithNoTests: true,
  },
});
