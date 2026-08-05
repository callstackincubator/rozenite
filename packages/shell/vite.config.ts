import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type PluginOption } from 'vite';

export default defineConfig({
  // The Tailwind Vite plugin currently resolves its own Vite type instance.
  // Both plugins are Vite-compatible at runtime; this cast avoids treating
  // their private Rollup types as incompatible.
  plugins: [tailwindcss(), react()] as unknown as PluginOption[],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    reportCompressedSize: false,
  },
});
