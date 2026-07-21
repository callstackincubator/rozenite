import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  createAsyncStorageAdapter,
  createExpoSecureStorageAdapter,
  createMMKVStorageAdapter,
} from '@rozenite/storage-plugin';
import { mmkvStorages } from './mmkv-storages';

export const asyncStorageV2 = AsyncStorage;
const createScopedAsyncStorage = (scope: string) => {
  const prefix = `${scope}:`;

  return {
    getAllKeys: async () =>
      (await AsyncStorage.getAllKeys())
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length)),
    getItem: (key: string) => AsyncStorage.getItem(`${prefix}${key}`),
    setItem: (key: string, value: string) =>
      AsyncStorage.setItem(`${prefix}${key}`, value),
    removeItem: (key: string) => AsyncStorage.removeItem(`${prefix}${key}`),
  };
};

export const asyncStorageScopedInstances = {
  auth: createScopedAsyncStorage('rozenite-playground-auth'),
  cache: createScopedAsyncStorage('rozenite-playground-cache'),
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
      'scoped-auth': {
        storage: asyncStorageScopedInstances.auth,
        name: 'AsyncStorage scoped (auth)',
      },
      'scoped-cache': {
        storage: asyncStorageScopedInstances.cache,
        name: 'AsyncStorage scoped (cache)',
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
