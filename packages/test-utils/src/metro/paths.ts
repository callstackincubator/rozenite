import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Root of this package (`packages/test-utils`). */
export const packageRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');

/** Root of the Rozenite monorepository. */
export const monorepoRoot = path.resolve(packageRoot, '../..');

/** Directory holding every Rozenite workspace package. */
export const packagesRoot = path.join(monorepoRoot, 'packages');
