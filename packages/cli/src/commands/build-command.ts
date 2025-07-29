import fs from 'node:fs/promises';
import path from 'node:path';
import { step } from '../utils/steps.js';
import { spawn } from '../utils/spawn.js';
import { fileExists } from '../utils/files.js';
import { intro, outro } from '../utils/prompts.js';

export const buildCommand = async (targetDir: string) => {
  intro('Rozenite');

  const hasReactNativeEntryPoint = await fileExists('react-native.ts');
  const hasMetroEntryPoint = await fileExists('metro.ts');

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
    }
  );

  await step(
    {
      start: 'Building panels',
      stop: 'Panels built',
      error: 'Failed to build panels',
    },
    async () => {
      await spawn('vite', ['build'], {
        cwd: targetDir,
      });
    }
  );

  if (hasMetroEntryPoint) {
    await step(
      {
        start: 'Building Metro entry point',
        stop: 'Metro entry point built',
        error: 'Failed to build Metro entry point',
      },
      async () => {
        await spawn('vite', ['build'], {
          cwd: targetDir,
          env: {
            VITE_ROZENITE_TARGET: 'server',
          },
        });
      }
    );
  }

  if (hasReactNativeEntryPoint) {
    await step(
      {
        start: 'Building React Native entry point',
        stop: 'React Native entry point built',
        error: 'Failed to build React Native entry point',
      },
      async () => {
        await spawn('vite', ['build'], {
          cwd: targetDir,
          env: {
            VITE_ROZENITE_TARGET: 'react-native',
          },
        });
      }
    );
  }

  outro('Plugin built successfully');
};
