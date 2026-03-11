export {
  createAsyncStorageAdapter,
  createExpoAsyncStorageAdapter,
  createExpoSecureStorageAdapter,
  createMMKVStorageAdapter,
} from './src/react-native/adapters';
export type {
  AsyncStorageInstanceConfig,
  AsyncStorageLike,
  CreateAsyncStorageAdapterOptions,
  CreateExpoAsyncStorageAdapterOptions,
  CreateExpoSecureStorageAdapterOptions,
  CreateMMKVStorageAdapterOptions,
  SecureStorageLike,
} from './src/react-native/adapters';

export type {
  AsyncStorage,
  StorageAdapter,
  StorageCapabilities,
  StorageEntry,
  StorageEntryType,
  StorageEntryValue,
  StorageNode,
  SyncStorage,
} from './src/shared/types';

export let useRozeniteStoragePlugin: typeof import('./src/react-native/useRozeniteStoragePlugin').useRozeniteStoragePlugin;

const isWeb =
  typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isWeb && !isServer) {
  useRozeniteStoragePlugin =
    require('./src/react-native/useRozeniteStoragePlugin').useRozeniteStoragePlugin;
} else {
  useRozeniteStoragePlugin = () => null;
}
