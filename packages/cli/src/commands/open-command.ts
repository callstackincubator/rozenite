import type { MetroTarget } from '@rozenite/agent-shared';
import { getMetroTargets } from './metro-discovery.js';
import { buildAppOpenUrl } from './open-url.js';
import { isInteractive } from '../utils/isInteractive.js';
import { intro, outro, promptSelect } from '../utils/prompts.js';
import { logger } from '../utils/logger.js';
import { spawn } from '../utils/spawn.js';

export type OpenCommandOptions = {
  host: string;
  port: number;
  deviceId?: string;
};

export const NON_INTERACTIVE_MESSAGE =
  '`rozenite open` must be run in an interactive terminal: it opens a browser window and picks a debugging target, which requires a terminal a person can respond to. Run it directly in a terminal instead of in CI or a piped/non-TTY shell.';

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

const getBrowserOpenerCommand = (): string => {
  switch (process.platform) {
    case 'darwin':
      return 'open';
    case 'win32':
      return 'start';
    default:
      return 'xdg-open';
  }
};

const tryOpenBrowser = async (url: string): Promise<boolean> => {
  try {
    await spawn(getBrowserOpenerCommand(), [url], { handleSignals: false });
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
    return;
  }

  const target = options.deviceId
    ? selectTargetById(targets, options.deviceId)
    : await promptForTarget(targets);

  const url = buildAppOpenUrl(options.host, options.port, target);
  const opened = await tryOpenBrowser(url);

  if (opened) {
    logger.success(`Opened Rozenite DevTools for ${target.name}`);
  } else {
    logger.warn(
      `Could not open a browser automatically for ${target.name}. Open this URL manually:`,
    );
  }

  logger.info(url);

  outro('Done');
};
