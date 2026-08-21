import * as SecureStore from 'expo-secure-store';
import {
  createAsyncStorageAdapter,
  createExpoSecureStorageAdapter,
  createMMKVStorageAdapter,
} from '@rozenite/storage-plugin';
import { mmkvStorages } from '../src/app/mmkv-storages';
import {
  asyncStorageV2,
  asyncStorageV3Instances,
  getKnownSecureStoreKeys,
} from '../src/app/storage-plugin-adapters';

// Split out of src/app/storage-plugin-adapters.ts: the app-owned storage
// instances and secure-store key registry stay in app code (screens use
// them directly); building the Rozenite adapters on top of them is
// dev-only.
export const storagePluginAdapters = [
  createMMKVStorageAdapter({
    adapterId: 'mmkv',
    adapterName: 'MMKV',
    storages: mmkvStorages,
    blacklist: {
      'user-storage': /sensitiveToken/,
    },
  }),
  createAsyncStorageAdapter({
    storages: {
      'v2-default': {
        storage: asyncStorageV2,
        name: 'AsyncStorage v2 (default)',
      },
      'v3-auth': {
        storage: asyncStorageV3Instances.auth,
        name: 'AsyncStorage v3 (auth)',
      },
      'v3-cache': {
        storage: asyncStorageV3Instances.cache,
        name: 'AsyncStorage v3 (cache)',
      },
    },
    adapterId: 'async-storage',
    adapterName: 'AsyncStorage',
  }),
  createExpoSecureStorageAdapter({
    storage: SecureStore,
    keys: async () => getKnownSecureStoreKeys(),
    adapterId: 'secure-store',
    adapterName: 'Expo SecureStore',
    storageId: 'secure-default',
    storageName: 'Default SecureStore',
  }),
];
