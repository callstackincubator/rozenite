import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type PluginOption } from 'vite';

export default defineConfig({
  // The Tailwind Vite plugin currently resolves its own Vite type instance.
  // Both plugins are Vite-compatible at runtime; this cast avoids treating
  // their private Rollup types as incompatible.
  plugins: [tailwindcss(), react()] as unknown as PluginOption[],
  // Load-bearing — do not change to './'. The middleware serves this build
  // at `/rozenite/app/` and rewrites incoming `/rozenite/*` requests by
  // stripping the `/rozenite` prefix before matching a route (see
  // `packages/middleware/src/middleware.ts`). Vite bakes `base` into every
  // emitted asset URL, so the browser must request assets from
  // `/rozenite/app/...` for that rewrite to line up; a relative base
  // (`'./'`) would instead resolve assets against wherever the HTML
  // document happens to be fetched from, which breaks once this bundle is
  // served from a subpath instead of opened as a standalone file.
  base: '/rozenite/app/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    reportCompressedSize: false,
  },
});
