import type { StorageAdapter, StorageNode } from '../../shared/types';

export type SecureStorageLike = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

type KeySource = string[] | (() => Promise<string[]>);

export type CreateExpoSecureStorageAdapterOptions = {
  storage: SecureStorageLike;
  keys: KeySource;
  adapterId?: string;
  adapterName?: string;
  storageId?: string;
  storageName?: string;
  blacklist?: RegExp;
};

const resolveKeys = async (source: KeySource) => {
  if (Array.isArray(source)) {
    return source;
  }

  return source();
};

export const createExpoSecureStorageAdapter = ({
  storage,
  keys,
  adapterId = 'expo-secure-store',
  adapterName = 'Expo SecureStore',
  storageId = 'default',
  storageName = 'Default Secure Storage',
  blacklist,
}: CreateExpoSecureStorageAdapterOptions): StorageAdapter => {
  const storageNode: StorageNode = {
    id: storageId,
    name: storageName,
    blacklist,
    capabilities: {
      supportedTypes: ['string'],
    },
    storage: {
      kind: 'async',
      getAllKeys: () => resolveKeys(keys),
      get: async (key) => {
        const value = await storage.getItemAsync(key);
        if (value === null) {
          return undefined;
        }

        return {
          key,
          type: 'string',
          value,
        };
      },
      set: async (entry) => {
        if (entry.type !== 'string') {
          throw new Error('Expo SecureStore adapter supports only string values.');
        }

        await storage.setItemAsync(entry.key, entry.value);
      },
      delete: (key) => storage.deleteItemAsync(key),
    },
  };

  return {
    id: adapterId,
    name: adapterName,
    storages: [storageNode],
  };
};
