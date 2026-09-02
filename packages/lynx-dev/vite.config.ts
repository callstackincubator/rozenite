/// <reference types='vitest' />
import { defineConfig } from 'vite';
import path, { resolve } from 'node:path';
import dts from 'vite-plugin-dts';
import packageJson from './package.json' with { type: 'json' };

// This package is now a thin deprecated re-export shim over
// `@rozenite/lynx/rspeedy` (see `src/index.ts`) — `@rozenite/lynx` is
// externalised, not bundled, same as any other dependency.
//
// Rollup's `external` array only matches an import specifier *exactly*
// against this list — `dependencies` here is `['@rozenite/lynx']`, and
// `import ... from '@rozenite/lynx/rspeedy'` (a different specifier, the
// package's subpath export) would not match it, silently bundling the
// entire rspeedy plugin into this shim (confirmed empirically: without
// this, the build ballooned to ~277 kB instead of staying a thin
// re-export). A predicate also externalises anything under a dependency's
// own subpath.
const dependencies = Object.keys(packageJson.dependencies || {});
const isExternal = (id: string): boolean =>
  dependencies.some((dep) => id === dep || id.startsWith(`${dep}/`));

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/lynx-dev',
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
      formats: ['es' as const, 'cjs' as const],
    },
    rollupOptions: {
      external: isExternal,
    },
  },
  test: {
    passWithNoTests: true,
  },
});
