/// <reference types='vitest' />
import { defineConfig } from 'vite';
import path, { resolve } from 'node:path';
import dts from 'vite-plugin-dts';
import packageJson from './package.json' assert { type: 'json' };

const dependencies = Object.keys(packageJson.dependencies || {});

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/web',
  base: './',
  plugins: [
    dts({
      entryRoot: '.',
      tsconfigPath: path.join(__dirname, 'tsconfig.metro.json'),
      rollupTypes: false,
      include: ['src/metro/**/*', 'metro.ts', 'globals.d.ts'],
      exclude: ['node_modules'],
    }),
  ],
  build: {
    outDir: 'dist/metro',
    ssr: true,
    lib: {
      entry: {
        metro: resolve(__dirname, 'metro.ts'),
      },
      formats: ['es' as const, 'cjs' as const],
    },
    rollupOptions: {
      external: dependencies,
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
