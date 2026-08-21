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

/**
 * The tail of a page title, when the title is a URL or file path.
 *
 * Lynx names a card by the bundle URL it was opened with, which is far too
 * long to put in a picker but whose last segment
 * (`main.lynx.bundle`, `homepage.lynx.bundle`) is exactly what tells two
 * cards apart. Titles that are not paths (React Native's own page names)
 * are left alone.
 */
const shortenTitle = (title: string): string => {
  const withoutQuery = title.split('?')[0];

  if (!withoutQuery.includes('/')) {
    return title;
  }

  const lastSegment = withoutQuery.split('/').filter(Boolean).pop();

  return lastSegment && lastSegment.length > 0 ? lastSegment : title;
};

/**
 * A device can offer several targets, so the label has to say which page
 * each one is -- the device name alone is the same for all of them.
 */
const formatTargetLabel = (target: MetroTarget): string => {
  const base = `${target.name} (${target.appId || target.title})`;
  const detail = shortenTitle(target.title);

  return detail.length > 0 && detail !== target.appId ? `${base} — ${detail}` : base;
};

const promptForTarget = async (targets: MetroTarget[]): Promise<MetroTarget> => {
  return promptSelect({
    message: 'Select a debugging target to open Rozenite DevTools for',
    options: targets.map((target) => ({
      value: target,
      label: formatTargetLabel(target),
    })),
  });
};

/**
 * Resolves `--deviceId`, which is accepted as either a target id (one
 * page) or a device id (every page on that device). The device form is
 * what the flag meant before targets became per-page, and is still the id
 * a person is most likely to have to hand -- so it keeps working, and only
 * asks which page when the device actually has more than one.
 */
export const selectTargetById = async (
  targets: MetroTarget[],
  deviceId: string,
): Promise<MetroTarget> => {
  const exactTarget = targets.find((candidate) => candidate.id === deviceId);

  if (exactTarget) {
    return exactTarget;
  }

  const targetsOnDevice = targets.filter((candidate) => candidate.deviceId === deviceId);

  if (targetsOnDevice.length === 1) {
    return targetsOnDevice[0];
  }

  if (targetsOnDevice.length > 1) {
    return promptForTarget(targetsOnDevice);
  }

  const validIds = targets.map((candidate) => candidate.id).join(', ');
  throw new Error(`Unknown deviceId "${deviceId}". Valid device IDs: ${validIds}`);
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
      ? await selectTargetById(targets, options.deviceId)
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
      'Could not launch the Rozenite standalone app. It requires `@rozenite/electron-app` to be installed in your project. Install it separately in addition to the CLI.',
    );
    process.exitCode = 1;
    outro('Done');
    return;
  }

  logger.success(`Opened Rozenite DevTools for ${target.name}`);
  outro('Done');
};
