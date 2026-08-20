import util from 'node:util';
import { log as clackLog } from '@clack/prompts';
import isUnicodeSupported from 'is-unicode-supported';
import { color } from './color.js';
import { isInteractive } from './isInteractive.js';

const unicode = isUnicodeSupported();

const unicodeWithFallback = (c: string, fallback: string) => (unicode ? c : fallback);

const SYMBOL_DEBUG = unicodeWithFallback('●', '•');

let verbose = false;

const success = (...messages: Array<unknown>) => {
  const output = util.format(...messages);
  clackLog.success(output);
};

const info = (...messages: Array<unknown>) => {
  const output = util.format(...messages);
  clackLog.info(output);
};

const warn = (...messages: Array<unknown>) => {
  const output = util.format(...messages);
  clackLog.warn(mapLines(output, color.yellow));
};

const error = (...messages: Array<unknown>) => {
  const output = util.format(...messages);
  clackLog.error(mapLines(output, color.red));
};

const log = (...messages: Array<unknown>) => {
  const output = util.format(...messages);
  clackLog.step(output);
};

const debug = (...messages: Array<unknown>) => {
  if (verbose) {
    const output = util.format(...messages);
    clackLog.message(mapLines(output, color.dim), {
      symbol: color.dim(SYMBOL_DEBUG),
    });
  }
};

const setVerbose = (level: boolean) => {
  verbose = level;
};

const isVerbose = () => {
  // For non-interactive environments, always show verbose logs
  return !isInteractive() || verbose;
};

// Whether verbose output was explicitly asked for, as opposed to `isVerbose()`
// which also covers non-interactive environments. Build tools are chatty on
// success, so streaming their output should require an actual opt-in.
const isVerboseRequested = () => verbose;

export const logger = {
  success,
  info,
  warn,
  error,
  debug,
  log,
  setVerbose,
  isVerbose,
  isVerboseRequested,
};

function mapLines(text: string, colorFn: (line: string) => string) {
  return text.split('\n').map(colorFn).join('\n');
}
