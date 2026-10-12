import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { inspectPackedPackage } from '@rozenite/test-utils/packaging';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Packs the package the way `pnpm publish` does and checks the tarball: every
// export/main/bin target is in it and no test, fixture or `rozenite.config.*`
// file ships.
describe('published package', () => {
  it('contains everything it points at and nothing development-only', () => {
    assert.deepEqual(inspectPackedPackage(PACKAGE_ROOT).problems, []);
  });
});
