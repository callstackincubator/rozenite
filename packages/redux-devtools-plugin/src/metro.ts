import type { ConfigT as MetroConfig } from 'metro-config';
import { createMetroConfigTransformer } from '@rozenite/tools';
import { REDUX_DEVTOOLS_PORT } from './constants';

export const withRozeniteReduxDevTools = createMetroConfigTransformer(
  async (config: MetroConfig): Promise<MetroConfig> => {
    // This is ESM only, so we need to import it dynamically in case of CJS
    const { default: setupWebSocketRelay } = await import(
      '@redux-devtools/cli'
    );
    setupWebSocketRelay({
      hostname: 'localhost',
      port: REDUX_DEVTOOLS_PORT,
      // This environment variable is set by Rozenite middleware.
      logLevel: process.env.ROZENITE_LOG_LEVEL,
    });

    return config;
  },
);
