import { spawn as spawnChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { MetroTarget } from '@rozenite/agent-shared';
import { getMetroTargets } from './metro-discovery.js';
import { buildAppOpenUrl } from './open-url.js';
import { isInteractive } from '../utils/isInteractive.js';
import { intro, outro, promptSelect } from '../utils/prompts.js';
import { logger } from '../utils/logger.js';

const require = createRequire(import.meta.url);

export type OpenCommandOptions = {
  host: string;
  port: number;
  deviceId?: string;
};

export const NON_INTERACTIVE_MESSAGE =
  '`rozenite open` must be run in an interactive terminal: it opens an app window and picks a debugging target, which requires a terminal a person can respond to. Run it directly in a terminal instead of in CI or a piped/non-TTY shell.';

export const selectTargetById = (targets: MetroTarget[], deviceId: string): MetroTarget => {
  const target = targets.find((candidate) => candidate.id === deviceId);

  if (!target) {
    const validIds = targets.map((candidate) => candidate.id).join(', ');
    throw new Error(`Unknown deviceId "${deviceId}". Valid device IDs: ${validIds}`);
  }

  return target;
};

const promptForTarget = async (targets: MetroTarget[]): Promise<MetroTarget> => {
  return promptSelect({
    message: 'Select a device to open Rozenite DevTools for',
    options: targets.map((target) => ({
      value: target,
      label: `${target.name} (${target.appId || target.title})`,
    })),
  });
};

export const resolveElectronAppLauncher = (): string | undefined => {
  try {
    const packageJsonPath = require.resolve('@rozenite/electron-app/package.json');
    return path.join(path.dirname(packageJsonPath), 'bin', 'launch.js');
  } catch {
    return undefined;
  }
};

const tryOpenElectron = (url: string): boolean => {
  const launcherPath = resolveElectronAppLauncher();

  if (!launcherPath) {
    return false;
  }

  try {
    const child = spawnChildProcess(process.execPath, [launcherPath, url], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
};

export const openCommand = async (options: OpenCommandOptions): Promise<void> => {
  if (!isInteractive()) {
    logger.error(NON_INTERACTIVE_MESSAGE);
    process.exitCode = 1;
    return;
  }

  intro('Rozenite');

  const targets = await getMetroTargets(options.host, options.port);

  if (targets.length === 0) {
    logger.error(
      `No connected device found at http://${options.host}:${options.port}. Open the Rozenite-enabled app on a device or simulator so it registers with Metro, then try again.`,
    );
    process.exitCode = 1;
    outro('Done');
    return;
  }

  let target: MetroTarget;

  try {
    target = options.deviceId
      ? selectTargetById(targets, options.deviceId)
      : await promptForTarget(targets);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    outro('Done');
    return;
  }

  const url = buildAppOpenUrl(options.host, options.port, target);

  if (!tryOpenElectron(url)) {
    logger.error(
      'Could not launch the Rozenite standalone app. It requires `@rozenite/electron-app`, which is installed alongside the CLI — try reinstalling `rozenite`.',
    );
    process.exitCode = 1;
    outro('Done');
    return;
  }

  logger.success(`Opened Rozenite DevTools for ${target.name}`);
  outro('Done');
};
