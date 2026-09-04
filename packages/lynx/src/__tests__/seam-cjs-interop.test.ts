import { mkdtempSync, rmSync, copyFileSync, writeFileSync } from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Regression test for a real bug an adversarial review caught and this
// suite's `release-bundle.test.ts` did not: `bundleLynxForRelease` always
// builds in production mode, where `enabled` (and therefore
// `installDevEntryRedirect`) is always false, so it never exercises the
// redirect this test targets.
//
// The built seam's CJS output (`dist/index.cjs`) must correctly unwrap
// whichever of two different shapes `require('./dev-entry.cjs')` resolves
// to, since `RozeniteResolverPlugin` (`@rozenite/middleware`) can rewrite
// that exact request to a different module at resolve time:
//
// 1. This package's own shipped noop (built by `vite.dev-entry.config.ts`,
//    `module.exports = fn` -- no `.default`, no `__esModule` marker).
// 2. The app's own `rozenite.dev.tsx`, once redirected there in
//    development -- compiled independently by rspack/webpack, whose CJS
//    interop wraps a default export as `{ default: fn, __esModule: true }`.
//
// This exercises the actual built `dist/index.cjs` (not the source
// `index.tsx`) through Node's real CommonJS loader: the bug lives entirely
// in what Rollup emits for the cross-module reference, invisible from the
// TypeScript source, which is identical either way. A real sibling
// `dev-entry.cjs` is written into a throwaway copy of `dist/` for each
// case, rather than mocking Node's module resolution, so `require()`
// behaves exactly as it would for a real consumer.
const distDir = path.resolve(fileURLToPath(import.meta.url), '../../../dist');
const seamCjsPath = path.join(distDir, 'index.cjs');

type RozeniteSeam = () => { type: () => string };

const renderWithDevEntryShape = (devEntrySource: string): string => {
  // Scratch directory nested under `dist/`, not the OS temp dir: Node's
  // module resolution for `@lynx-js/react/jsx-runtime` (a real, installed
  // peer dependency, not something this test mocks) needs to walk up
  // through this package's own `node_modules`, which an OS-temp-dir
  // location would not be a descendant of.
  const scratchDir = mkdtempSync(path.join(distDir, '.seam-cjs-interop-test-'));

  try {
    const scratchSeamPath = path.join(scratchDir, 'index.cjs');
    copyFileSync(seamCjsPath, scratchSeamPath);
    writeFileSync(path.join(scratchDir, 'dev-entry.cjs'), devEntrySource);

    // `@lynx-js/react/jsx-runtime` resolves normally (it's a real,
    // installed package) -- only `./dev-entry.cjs`, relative to the
    // scratch copy of the seam, needs to be a fresh module each call.
    delete (Module as unknown as { _cache: Record<string, unknown> })._cache[scratchSeamPath];

    const Rozenite = require(scratchSeamPath) as RozeniteSeam;
    const element = Rozenite();

    return element.type();
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
};

describe('the built seam (dist/index.cjs) unwraps its dev entry correctly', () => {
  it("renders the component when require() resolves this package's own noop shape", () => {
    const rendered = renderWithDevEntryShape('module.exports = () => "own-noop";');

    expect(rendered).toBe('own-noop');
  });

  it('renders the component when require() resolves a redirected ES-module-interop shape', () => {
    const rendered = renderWithDevEntryShape(
      'Object.defineProperty(exports, "__esModule", { value: true });\n' +
        'exports.default = () => "redirected-rozenite-dev";',
    );

    expect(rendered).toBe('redirected-rozenite-dev');
  });
});
