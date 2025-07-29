import { devToolsEnhancer } from '@redux-devtools/remote';
import { Platform } from 'react-native';
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

export const rozeniteDevToolsEnhancer = (): StoreEnhancer => {
  return devToolsEnhancer({
    name: getDeviceId(),
    hostname: Platform.OS === 'android' ? '10.0.2.2' : 'localhost',
    port: REDUX_DEVTOOLS_PORT,
    secure: false,
    realtime: true,
  });
};
