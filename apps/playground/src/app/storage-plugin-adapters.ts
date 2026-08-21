import AsyncStorage, { createAsyncStorage } from '@react-native-async-storage/async-storage';

// App-owned storage instances and the secure-store key registry. The
// Rozenite storage adapters built on top of these live in
// rozenite.dev/storage-adapters.ts — this file has no `@rozenite/*` import
// because it is reachable from ordinary screens (StoragePluginScreen).
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
