/// <reference types='vitest' />
import path, { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const external = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'tslib',
  /^@heroui\//,
  /^@radix-ui\/react-tabs$/,
  /^@tanstack\/react-table$/,
  /^lucide-react$/,
  /^react-json-tree$/,
  /^react-virtuoso$/,
  /^tailwind-variants$/,
];

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/ui',
  base: './',
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
      rollupTypes: true,
    }),
  ],
  build: {
    ssr: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external,
    },
  },
});
