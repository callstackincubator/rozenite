import AsyncStorage, {
  createAsyncStorage,
} from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  createAsyncStorageAdapter,
  createExpoSecureStorageAdapter,
  createMMKVStorageAdapter,
} from '@rozenite/storage-plugin';
import { mmkvStorages } from './mmkv-storages';

export const asyncStorageV2 = AsyncStorage;
export const asyncStorageV3Instances = {
  auth: createAsyncStorage('rozenite-playground-auth'),
  cache: createAsyncStorage('rozenite-playground-cache'),
};

const secureStoreKnownKeys = new Set<string>(['token', 'session']);

export const rememberSecureStoreKey = (key: string) => {
  if (!key.trim()) {
    return;
  }

  secureStoreKnownKeys.add(key.trim());
};

export const forgetSecureStoreKey = (key: string) => {
  secureStoreKnownKeys.delete(key);
};

export const getKnownSecureStoreKeys = () => [...secureStoreKnownKeys.values()];

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
