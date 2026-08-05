/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      tsconfigPath: './tsconfig.lib.json',
      rollupTypes: true,
    }),
  ],
  root: __dirname,
  cacheDir: '../../node_modules/.vite/ui',
  base: './',
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      fileName: 'index',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react-resizable-panels',
        'lucide-react',
        'clsx',
        'tailwind-merge',
        'class-variance-authority',
      ],
    },
  },
  test: {
    passWithNoTests: true,
  },
  server: {
    port: 3000,
    open: true,
  },
});
