import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { getSnapshotDir } from './baseline';

/**
 * On-device Network Activity suite; see docs/agents/network-activity-e2e.md.
 * Deliberately not part of `pnpm test`.
 *
 * - `e2e:network` compares. It runs with `CI=1`, which makes Vitest fail on a
 *   missing snapshot instead of writing it.
 * - `e2e:network:record` records (`--update`) and rewrites `baseline.json`.
 */
const platform = process.env.ROZENITE_E2E_PLATFORM || 'ios';

export default defineConfig({
  root: __dirname,
  test: {
    include: ['network-activity.e2e.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 60_000,
    // Above the worst-case sum of setup's own step timeouts (125 s, see
    // harness.ts), so a hang is reported by the step that hung.
    hookTimeout: 150_000,
    resolveSnapshotPath: (testPath, snapshotExtension) =>
      path.join(getSnapshotDir(platform), `${path.basename(testPath)}${snapshotExtension}`),
  },
});
