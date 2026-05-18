import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const HOST_APP_ROOT = fileURLToPath(new URL('./', import.meta.url));
const PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  root: HOST_APP_ROOT,
  base: './',
  publicDir: false,
  build: {
    outDir: path.join(PACKAGE_ROOT, 'dist', 'dev-host'),
    emptyOutDir: true,
    manifest: 'manifest.json',
    // The dev host is served locally during plugin development, so the
    // default production-oriented chunk warning is just noise here.
    chunkSizeWarningLimit: 1000,
  },
});
