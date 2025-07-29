import type { ConfigT as MetroConfig } from 'metro-config';
import { REDUX_DEVTOOLS_PORT } from './constants';
import setupWebSocketRelay from '@redux-devtools/cli';

export const withRozeniteReduxDevTools = <
  T extends MetroConfig | Promise<MetroConfig>
>(
  config: T
): T => {
  setupWebSocketRelay({
    hostname: 'localhost',
    port: REDUX_DEVTOOLS_PORT,
  });

  return config;
};

export type Wololo = true;
