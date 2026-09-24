import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * On-device Network Activity suite. Run with `pnpm --filter @rozenite/playground e2e:network`;
 * see docs/agents/network-activity-e2e.md. Deliberately not part of `pnpm test`.
 */
const platform = process.env.ROZENITE_E2E_PLATFORM || 'ios';

export default defineConfig({
  root: __dirname,
  test: {
    include: ['network-activity.e2e.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 60_000,
    // Setup fails fast on its own (see harness.ts); this only bounds a hung device.
    hookTimeout: 120_000,
    // Wire formats differ between iOS and Android networking stacks, so each
    // platform keeps its own baselines.
    resolveSnapshotPath: (testPath, snapshotExtension) =>
      path.join(
        path.dirname(testPath),
        '__snapshots__',
        platform,
        `${path.basename(testPath)}${snapshotExtension}`,
      ),
  },
});
