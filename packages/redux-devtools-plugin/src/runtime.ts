import { devToolsEnhancer } from '@redux-devtools/remote';
import { Platform } from 'react-native';
import getDevServer from 'react-native/Libraries/Core/Devtools/getDevServer';
import { REDUX_DEVTOOLS_PORT } from './constants';

// @ts-expect-error - Symbol.asyncIterator is not defined in the global scope, but required by the redux-devtools/remote package.
Symbol.asyncIterator ??= Symbol.for('Symbol.asyncIterator');

type StoreEnhancer = ReturnType<typeof devToolsEnhancer>;

const getDeviceId = (): string => {
  if (Platform.OS === 'android') {
    return `${Platform.constants.Manufacturer} ${Platform.constants.Model}`;
  }

  if (Platform.OS === 'ios') {
    return `${Platform.constants.systemName} ${Platform.constants.osVersion}`;
  }

  throw new Error('Unsupported platform');
};

const getHostname = (): string => {
  const devServer = getDevServer();
  return devServer.url.split('://')[1].split(':')[0];
};

export const rozeniteDevToolsEnhancer = (): StoreEnhancer => {
  return devToolsEnhancer({
    name: getDeviceId(),
    hostname: getHostname(),
    port: REDUX_DEVTOOLS_PORT,
    secure: false,
    realtime: true,
  });
};
