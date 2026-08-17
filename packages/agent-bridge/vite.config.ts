import { defineConfig } from 'vite';
import { rozenitePlugin } from '@rozenite/vite-plugin';

// The "build" script sets VITE_ROZENITE_TARGET=react-native so this builds
// against react-native.ts (the only entry point this package ships — no
// devtools panel). That gives it the same NODE_ENV-gated require()/shim
// pattern as the other plugins, so its real implementation (and its
// @rozenite/plugin-bridge dependency) is stripped from production Metro
// bundles.
export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/agent-bridge',
  base: './',
  plugins: [rozenitePlugin()],
  build: {
    outDir: './dist',
    reportCompressedSize: false,
    minify: true,
    sourcemap: false,
  },
});
