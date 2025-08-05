const PREFIX = '[Rozenite]';

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    console.log(`${PREFIX} ${message}`, ...args);
  },

  warn: (message: string, ...args: unknown[]) => {
    console.warn(`${PREFIX} ${message}`, ...args);
  },

  error: (message: string, ...args: unknown[]) => {
    console.error(`${PREFIX} ${message}`, ...args);
  },

  debug: (message: string, ...args: unknown[]) => {
    if (process.env.ROZENITE_DEBUG === 'true') {
      console.log(`${PREFIX} [DEBUG] ${message}`, ...args);
    }
  },
};
