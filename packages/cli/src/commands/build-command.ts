import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { step } from '../utils/steps.js';
import { spawn } from '../utils/spawn.js';
import { intro, outro } from '../utils/prompts.js';
import { logger } from '../utils/logger.js';
import { syncPluginPackageJSON } from '../utils/plugin-package-json.js';
import { runWithConcurrency } from '../utils/concurrency.js';

export const buildCommand = async (targetDir: string) => {
  intro('Rozenite');

  const { updatedFields, targets } = await syncPluginPackageJSON(targetDir);

  if (updatedFields.length > 0) {
    logger.warn(
      `Updated package.json builder-managed fields: ${updatedFields.join(', ')}`,
    );
  }

  const { hasReactNativeEntryPoint, hasMetroEntryPoint, hasSdkEntryPoint } =
    targets;

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

  const buildJobs = [
    {
      start: 'Building panels',
      stop: 'Panels built',
      error: 'Failed to build panels',
      env: undefined,
    },
    ...(hasMetroEntryPoint
      ? [
          {
            start: 'Building Metro entry point',
            stop: 'Metro entry point built',
            error: 'Failed to build Metro entry point',
            env: { VITE_ROZENITE_TARGET: 'server' },
          },
        ]
      : []),
    ...(hasReactNativeEntryPoint
      ? [
          {
            start: 'Building React Native entry point',
            stop: 'React Native entry point built',
            error: 'Failed to build React Native entry point',
            env: { VITE_ROZENITE_TARGET: 'react-native' },
          },
        ]
      : []),
    ...(hasSdkEntryPoint
      ? [
          {
            start: 'Building SDK entry point',
            stop: 'SDK entry point built',
            error: 'Failed to build SDK entry point',
            env: { VITE_ROZENITE_TARGET: 'sdk' },
          },
        ]
      : []),
  ];

  await runWithConcurrency(
    buildJobs.map(
      (job) => () =>
        step(job, async () => {
          await spawn('vite', ['build'], {
            cwd: targetDir,
            env: job.env,
          });
        }),
    ),
    os.availableParallelism(),
  );

  outro('Plugin built successfully');
};
