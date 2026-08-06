import { spawn, Subprocess } from '../utils/spawn.js';
import { intro, outro } from '../utils/prompts.js';
import { logger } from '../utils/logger.js';
import { syncPluginPackageJSON } from '../utils/plugin-package-json.js';
import { isInteractive } from '../utils/isInteractive.js';

const getLocalUrl = async (process: Subprocess) => {
  const childProcess = await process.nodeChildProcess;

  return new Promise<string>((resolve, reject) => {
    const stdout = childProcess.stdout;
    if (!stdout) {
      reject(new Error('The Vite development server has no stdout stream.'));
      return;
    }

    const handleData = (chunk: Buffer) => {
      const localUrl = chunk.toString().match(/Local:\s+(https?:\/\/\S+)/)?.[1];

      if (!localUrl) {
        return;
      }

      cleanup();
      resolve(localUrl);
    };

    const handleExit = () => {
      cleanup();
      reject(new Error('The Vite development server stopped before reporting a URL.'));
    };

    const cleanup = () => {
      stdout.off('data', handleData);
      childProcess.off('exit', handleExit);
    };

    stdout.on('data', handleData);
    childProcess.once('exit', handleExit);
  });
};

const stopProcesses = async (processes: Subprocess[]) => {
  const settledProcesses = processes.map((process) => process.catch(() => undefined));

  await Promise.all(
    processes.map(async (process) => {
      const childProcess = await process.nodeChildProcess;

      if (!childProcess.killed) {
        childProcess.kill('SIGTERM');
      }
    }),
  );

  await Promise.all(settledProcesses);
};

export const devCommand = async (targetDir: string) => {
  intro('Rozenite');

  const { updatedFields, targets } = await syncPluginPackageJSON(targetDir);

  if (updatedFields.length > 0) {
    logger.warn(`Updated package.json builder-managed fields: ${updatedFields.join(', ')}`);
  }

  const { hasReactNativeEntryPoint, hasMetroEntryPoint } = targets;

  try {
    const processes: Subprocess[] = [];

    if (hasReactNativeEntryPoint) {
      const rnProcess = spawn('vite', ['build', '--watch'], {
        cwd: targetDir,
        handleSignals: false,
        env: {
          VITE_ROZENITE_TARGET: 'react-native',
        },
      });
      processes.push(rnProcess);
    }

    if (hasMetroEntryPoint) {
      const metroProcess = spawn('vite', ['build', '--watch'], {
        cwd: targetDir,
        handleSignals: false,
        env: {
          VITE_ROZENITE_TARGET: 'server',
        },
      });
      processes.push(metroProcess);
    }

    const clientProcess = spawn('vite', ['dev', isInteractive() ? '--open' : '--no-open'], {
      cwd: targetDir,
      handleSignals: false,
      stdout: 'pipe',
      env: {
        VITE_ROZENITE_TARGET: 'client',
      },
    });
    processes.push(clientProcess);

    const localUrlPromise = getLocalUrl(clientProcess);

    await Promise.all(processes.map((p) => p.nodeChildProcess));

    const localUrl = await localUrlPromise;
    logger.info(`Open the Dev Host at ${localUrl}`);
    logger.info('Development servers are running... Press Ctrl+C to stop');

    await new Promise<void>((resolve) => {
      const handleShutdown = () => {
        process.off('SIGINT', handleShutdown);
        process.off('SIGTERM', handleShutdown);
        resolve();
      };
      process.on('SIGINT', handleShutdown);
      process.on('SIGTERM', handleShutdown);
    });

    await stopProcesses(processes);
  } catch (error) {
    logger.error('Failed to start development servers:', error);
    throw error;
  }

  outro('Development environment stopped');
};
