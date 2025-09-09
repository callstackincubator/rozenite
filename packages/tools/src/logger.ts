export type RozeniteLogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

const PREFIX = '[Rozenite]';

const LOG_LEVELS: Record<RozeniteLogLevel, number> = {
  none: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

let logLevel: RozeniteLogLevel = 'info';

const setLevel = (level: RozeniteLogLevel) => {
  logLevel = level;

  // Temporarily set the log level in the environment variable for the plugins
  // to use it in their own logging.
  process.env.ROZENITE_LOG_LEVEL = level;
};

const shouldLog = (messageLevel: RozeniteLogLevel): boolean => {
  return LOG_LEVELS[messageLevel] <= LOG_LEVELS[logLevel];
};

const info = (message: string, ...args: unknown[]) => {
  if (shouldLog('info')) {
    console.log(`${PREFIX} ${message}`, ...args);
  }
};

const warn = (message: string, ...args: unknown[]) => {
  if (shouldLog('warn')) {
    console.warn(`${PREFIX} ${message}`, ...args);
  }
};

const error = (message: string, ...args: unknown[]) => {
  if (shouldLog('error')) {
    console.error(`${PREFIX} ${message}`, ...args);
  }
};

const debug = (message: string, ...args: unknown[]) => {
  if (shouldLog('debug')) {
    console.log(`${PREFIX} [DEBUG] ${message}`, ...args);
  }
};

export const logger = {
  setLevel,
  info,
  warn,
  error,
  debug,
};
