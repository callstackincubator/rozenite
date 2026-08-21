import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_POLYFILL = path.join(PACKAGE_ROOT, 'src', 'metro', 'setup.js');

type MetroSerializer = { getPolyfills?: () => string[] };

type MetroEntry = {
  withRozeniteRequireProfiler: (config: { serializer?: MetroSerializer }) => {
    serializer?: MetroSerializer;
  };
};

const loadMetroEntry = (): MetroEntry =>
  require(path.join(PACKAGE_ROOT, 'dist', 'metro', 'metro.js')) as MetroEntry;

// The polyfill is injected into the app bundle and executed verbatim by Metro,
// so it is referenced straight out of `src` instead of being compiled or
// copied. That makes the path depend on how deep tsc emits the Metro entry
// point, which only the built output can confirm.
describe('Metro polyfill', () => {
  it('resolves to the untouched source file from the built Metro entry point', () => {
    const { withRozeniteRequireProfiler } = loadMetroEntry();

    const config = withRozeniteRequireProfiler({ serializer: {} });
    const injected = config.serializer?.getPolyfills?.().at(-1);

    expect(injected).toBe(SOURCE_POLYFILL);
    expect(fs.existsSync(SOURCE_POLYFILL)).toBe(true);
  });

  it('injects nothing when Metro is bundling for release', () => {
    // `getPolyfills` entries reach the graph by absolute path rather than
    // through module resolution, so the production resolver guard cannot see
    // them. This gate is what keeps the instrumentation out of a release
    // bundle, and it is easy to remove by accident.
    const originalArgv = process.argv;
    process.argv = ['node', '/app/node_modules/.bin/react-native', 'bundle'];

    try {
      const { withRozeniteRequireProfiler } = loadMetroEntry();

      const config = withRozeniteRequireProfiler({ serializer: {} });

      expect(config.serializer?.getPolyfills).toBeUndefined();
    } finally {
      process.argv = originalArgv;
    }
  });

  it('ships the polyfill in the published package', () => {
    // No `files` field, so `src` is published; the entry point resolves the
    // polyfill relative to the package root at runtime.
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'),
    ) as { files?: string[] };

    expect(packageJson.files).toBeUndefined();

    const npmIgnore = fs.readFileSync(path.join(PACKAGE_ROOT, '.npmignore'), 'utf8');
    expect(npmIgnore.split('\n').map((line) => line.trim())).not.toContain('src');
  });
});
