import type { Options, Subprocess } from 'nano-spawn';
import nanoSpawn, { SubprocessError } from 'nano-spawn';
import { logger } from './logger.js';

export type SpawnOptions = Options & {
  /** Let the caller coordinate shutdown for a group of related processes. */
  handleSignals?: boolean;
};

export const spawn = (
  file: string,
  args?: readonly string[],
  options?: SpawnOptions,
): Subprocess => {
  const { handleSignals = true, ...nanoSpawnOptions } = options ?? {};
  const defaultStream = logger.isVerbose() ? 'inherit' : 'pipe';
  const defaultOptions: Options = {
    stdin: defaultStream,
    stdout: defaultStream,
    // Always 'pipe' stderr to handle errors properly down the line
    stderr: 'pipe',
  };
  logger.debug(`Running: ${file}`, ...(args ?? []));
  const childProcess = nanoSpawn(file, args, {
    ...defaultOptions,
    ...nanoSpawnOptions,
  });

  if (handleSignals) {
    setupChildProcessCleanup(childProcess);
  }
  return childProcess;
};

export type { Subprocess, SubprocessError };

/**
 * A build tool exited non-zero and already explained why. The CLI prints the
 * captured output on its own, without a stack trace or a "report a bug" hint -
 * the failure is in the user's plugin, not in Rozenite.
 */
export class BuildToolError extends Error {
  override name = 'BuildToolError';
}

/**
 * Turns a failed subprocess into an error carrying the tool's own output, so a
 * bare exit code does not swallow the diagnostics. Build tools report to
 * stdout as often as to stderr, so both are folded in.
 */
export const withSubprocessOutput = (error: unknown): unknown => {
  if (!(error instanceof Error)) {
    return error;
  }

  const output = (error as { output?: string }).output?.trim();

  if (!output) {
    return error;
  }

  return new BuildToolError(output, { cause: error });
};

/**
 * Runs a build tool with its output captured rather than streamed, and
 * re-throws with that output attached when it fails.
 *
 * The CLI already reports progress one step at a time, so a successful tool's
 * output is noise - and `spawn` would otherwise stream it in every
 * non-interactive environment, which is exactly where it is least readable.
 * `--verbose` streams it live instead.
 */
export const spawnCapturingOutput = async (
  file: string,
  args?: readonly string[],
  options?: SpawnOptions,
): Promise<void> => {
  if (logger.isVerboseRequested()) {
    await spawn(file, args, { ...options, stdout: 'inherit', stderr: 'inherit' });
    return;
  }

  try {
    await spawn(file, args, { ...options, stdout: 'pipe', stderr: 'pipe' });
  } catch (error) {
    throw withSubprocessOutput(error);
  }
};

const setupChildProcessCleanup = (childProcess: Subprocess) => {
  // https://stackoverflow.com/questions/53049939/node-daemon-wont-start-with-process-stdin-setrawmodetrue/53050098#53050098
  if (process.stdin.isTTY) {
    // overwrite @clack/prompts setting raw mode for spinner and prompts,
    // which prevents listening for SIGINT and SIGTERM
    process.stdin.setRawMode(false);
  }

  const terminate = async () => {
    try {
      (await childProcess.nodeChildProcess).kill();
      process.exit(1);
    } catch {
      // ignore
    }
  };

  const sigintHandler = () => terminate();
  const sigtermHandler = () => terminate();

  process.on('SIGINT', sigintHandler);
  process.on('SIGTERM', sigtermHandler);

  const cleanup = () => {
    process.off('SIGINT', sigintHandler);
    process.off('SIGTERM', sigtermHandler);
  };

  childProcess.nodeChildProcess.finally(cleanup);
};
