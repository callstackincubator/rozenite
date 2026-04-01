import { spawn, Subprocess } from '../utils/spawn.js';
import { intro, outro } from '../utils/prompts.js';
import { logger } from '../utils/logger.js';
import { syncPluginPackageJSON } from '../utils/plugin-package-json.js';

export const devCommand = async (targetDir: string) => {
  intro('Rozenite');

  const { updatedFields, targets } = await syncPluginPackageJSON(targetDir);

  if (updatedFields.length > 0) {
    logger.warn(
      `Updated package.json builder-managed fields: ${updatedFields.join(', ')}`,
    );
  }

  const { hasReactNativeEntryPoint, hasMetroEntryPoint } = targets;

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

    if (hasMetroEntryPoint) {
      const metroProcess = spawn('vite', ['build', '--watch'], {
        cwd: targetDir,
        env: {
          VITE_ROZENITE_TARGET: 'server',
        },
      });
      processes.push(metroProcess);
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
