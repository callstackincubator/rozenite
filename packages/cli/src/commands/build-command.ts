import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { step } from '../utils/steps.js';
import { spawnCapturingOutput } from '../utils/spawn.js';
import { intro, outro } from '../utils/prompts.js';
import { logger } from '../utils/logger.js';
import { syncPluginPackageJSON } from '../utils/plugin-package-json.js';
import { runWithConcurrency } from '../utils/concurrency.js';
import {
  assertTsconfigExists,
  buildTarget,
  PluginTarget,
  TARGET_LABEL,
} from '../utils/tsc-build.js';

type BuildJob = {
  start: string;
  stop: string;
  error: string | ((error: unknown) => string);
  run: (signal: AbortSignal) => Promise<unknown>;
};

export const buildCommand = async (targetDir: string) => {
  intro('Rozenite');

  const { updatedFields, targets } = await syncPluginPackageJSON(targetDir);

  if (updatedFields.length > 0) {
    logger.warn(`Updated package.json builder-managed fields: ${updatedFields.join(', ')}`);
  }

  const { hasReactNativeEntryPoint, hasMetroEntryPoint, hasSdkEntryPoint } = targets;

  const tscTargets: PluginTarget[] = [
    ...(hasMetroEntryPoint ? (['metro'] as const) : []),
    ...(hasReactNativeEntryPoint ? (['react-native'] as const) : []),
    ...(hasSdkEntryPoint ? (['sdk'] as const) : []),
  ];

  if (tscTargets.length > 0) {
    await assertTsconfigExists(targetDir);
  }

  await step(
    {
      start: 'Cleaning output directory',
      stop: 'Output directory cleaned',
      error: 'Failed to clean output directory',
    },
    async () => {
      await fs.rm(path.join(targetDir, 'dist'), {
        recursive: true,
        force: true,
      });
    },
  );

  const buildController = new AbortController();

  // The first job to fail aborts the rest, and a job killed that way is not
  // itself a failure worth reporting - only the original cause is.
  const failureLabel = (what: string) => (error: unknown) =>
    buildController.signal.aborted && buildController.signal.reason !== error
      ? `Cancelled building ${what}`
      : `Failed to build ${what}`;

  const buildJobs: BuildJob[] = [
    {
      start: 'Building panels',
      stop: 'Panels built',
      error: failureLabel('panels'),
      // Panels are the only target that still needs bundling - they ship as a
      // browser bundle rather than as a resolvable package entry point.
      run: (signal) =>
        spawnCapturingOutput('vite', ['build'], {
          cwd: targetDir,
          preferLocal: true,
          env: { ROZENITE_BUILD: '1' },
          signal,
        }),
    },
    ...tscTargets.map((target) => ({
      start: `Building ${TARGET_LABEL[target]} entry point`,
      stop: `${TARGET_LABEL[target]} entry point built`,
      error: failureLabel(`the ${TARGET_LABEL[target]} entry point`),
      run: (signal: AbortSignal) => buildTarget(targetDir, target, { signal }),
    })),
  ];

  try {
    await runWithConcurrency(
      buildJobs.map((job) => async () => {
        try {
          await step(job, async () => {
            await job.run(buildController.signal);
          });
        } catch (error) {
          buildController.abort(error);
          throw error;
        }
      }),
      os.availableParallelism(),
      { signal: buildController.signal },
    );
  } catch (error) {
    buildController.abort(error);
    throw error;
  }

  outro('Plugin built successfully');
};
