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

export let createAsyncStorageAdapter: typeof import('./src/react-native/adapters').createAsyncStorageAdapter;
export let createExpoAsyncStorageAdapter: typeof import('./src/react-native/adapters').createExpoAsyncStorageAdapter;
export let createExpoSecureStorageAdapter: typeof import('./src/react-native/adapters').createExpoSecureStorageAdapter;
export let createMMKVStorageAdapter: typeof import('./src/react-native/adapters').createMMKVStorageAdapter;
export let useRozeniteStoragePlugin: typeof import('./src/react-native/useRozeniteStoragePlugin').useRozeniteStoragePlugin;

const isWeb =
  typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

const createNoopStorageAdapter = (
  options: { adapterId?: string; adapterName?: string } | undefined,
  defaultId: string,
  defaultName: string
) => ({
  id: options?.adapterId ?? defaultId,
  name: options?.adapterName ?? defaultName,
  storages: [],
});

if (!isDev || isServer) {
  createAsyncStorageAdapter = ((
    options: { adapterId?: string; adapterName?: string }
  ) =>
    createNoopStorageAdapter(
      options,
      'async-storage',
      'AsyncStorage'
    )) as typeof createAsyncStorageAdapter;
  createExpoAsyncStorageAdapter = createAsyncStorageAdapter;
  createExpoSecureStorageAdapter = ((options: {
    adapterId?: string;
    adapterName?: string;
  }) =>
    createNoopStorageAdapter(
      options,
      'expo-secure-store',
      'Expo SecureStore'
    )) as typeof createExpoSecureStorageAdapter;
  createMMKVStorageAdapter = ((
    options: { adapterId?: string; adapterName?: string }
  ) => createNoopStorageAdapter(options, 'mmkv', 'MMKV')) as typeof createMMKVStorageAdapter;
  useRozeniteStoragePlugin = () => null;
} else if (isWeb) {
  const asyncStorageModule = require('./src/react-native/adapters/async-storage');
  const secureStorageModule = require('./src/react-native/adapters/secure-storage');

  createAsyncStorageAdapter = asyncStorageModule.createAsyncStorageAdapter;
  createExpoAsyncStorageAdapter = asyncStorageModule.createExpoAsyncStorageAdapter;
  createExpoSecureStorageAdapter = secureStorageModule.createExpoSecureStorageAdapter;
  createMMKVStorageAdapter = ((
    options: { adapterId?: string; adapterName?: string }
  ) => createNoopStorageAdapter(options, 'mmkv', 'MMKV')) as typeof createMMKVStorageAdapter;
  useRozeniteStoragePlugin =
    require('./src/react-native/useRozeniteStoragePlugin').useRozeniteStoragePlugin;
} else {
  createAsyncStorageAdapter =
    require('./src/react-native/adapters').createAsyncStorageAdapter;
  createExpoAsyncStorageAdapter =
    require('./src/react-native/adapters').createExpoAsyncStorageAdapter;
  createExpoSecureStorageAdapter =
    require('./src/react-native/adapters').createExpoSecureStorageAdapter;
  createMMKVStorageAdapter =
    require('./src/react-native/adapters').createMMKVStorageAdapter;
  useRozeniteStoragePlugin =
    require('./src/react-native/useRozeniteStoragePlugin').useRozeniteStoragePlugin;
}
