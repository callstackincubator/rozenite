import fs from 'node:fs/promises';
import { step } from '../../utils/steps.js';

export const createProjectDirectory = async (
  projectRoot: string
): Promise<void> => {
  await step(
    {
      start: 'Creating plugin directory',
      stop: 'Plugin directory created',
      error: 'Failed to create plugin directory',
    },
    async () => {
      await fs.mkdir(projectRoot, { recursive: true });
    }
  );
};
