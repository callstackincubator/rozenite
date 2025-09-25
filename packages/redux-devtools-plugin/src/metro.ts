import { REDUX_DEVTOOLS_PORT } from './constants';

export const withRozeniteReduxDevTools = <T>(
  config: T
): T => {
  // This is ESM only, so we need to import it dynamically in case of CJS
  import('@redux-devtools/cli').then(({ default: setupWebSocketRelay }) => {
    setupWebSocketRelay({
      hostname: 'localhost',
      port: REDUX_DEVTOOLS_PORT,
      // This environment variable is set by Rozenite middleware.
      logLevel: process.env.ROZENITE_LOG_LEVEL,
    });
  });

  return config;
};
