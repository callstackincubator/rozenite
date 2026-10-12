import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { inspectPackedPackage } from '@rozenite/test-utils/packaging';

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');

// Packs the built package the way `pnpm publish` does and checks the tarball:
// every export/main/bin target is in it, `development` is not in the published
// exports, and no test, fixture or `rozenite.config.*` file ships.
describe('published package', () => {
  it('contains everything it points at and nothing development-only', () => {
    expect(inspectPackedPackage(PACKAGE_ROOT).problems).toEqual([]);
  }, 60_000);
});
