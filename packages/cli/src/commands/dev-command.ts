import { spawn, Subprocess } from '../utils/spawn.js';
import { fileExists } from '../utils/files.js';
import { intro, outro } from '../utils/prompts.js';
import { logger } from '../utils/logger.js';

export const devCommand = async (targetDir: string) => {
  intro('Rozenite');

  const hasReactNativeEntryPoint = await fileExists('react-native.ts');

  try {
    const processes: Subprocess[] = [];

    if (hasReactNativeEntryPoint) {
      const rnProcess = spawn('vite', ['build', '--watch'], {
        cwd: targetDir,
        env: {
          VITE_ROZENITE_TARGET: 'react-native',
        },
      });
      processes.push(rnProcess);
    }

    const clientProcess = spawn('vite', ['dev'], {
      cwd: targetDir,
      env: {
        VITE_ROZENITE_TARGET: 'client',
      },
    });
    processes.push(clientProcess);

    await Promise.all(processes.map((p) => p.nodeChildProcess));

    logger.info('Development servers are running... Press Ctrl+C to stop');

    await new Promise<void>((resolve) => {
      const handleSigInt = () => {
        process.off('SIGINT', handleSigInt);
        resolve();
      };
      process.on('SIGINT', handleSigInt);
    });
  } catch (error) {
    logger.error('Failed to start development servers:', error);
    throw error;
  }

  outro('Development environment stopped');
};
