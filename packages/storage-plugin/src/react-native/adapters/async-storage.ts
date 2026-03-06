import type { StorageAdapter, StorageNode } from '../../shared/types';

export type AsyncStorageLike = {
  getAllKeys: () => Promise<string[]>;
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export type AsyncStorageInstanceConfig = {
  storage: AsyncStorageLike;
  name?: string;
  blacklist?: RegExp;
};

type SingleStorageOptions = {
  storage: AsyncStorageLike;
  adapterId?: string;
  adapterName?: string;
  storageId?: string;
  storageName?: string;
  blacklist?: RegExp;
};

type MultiStorageOptions = {
  storages: Record<string, AsyncStorageLike | AsyncStorageInstanceConfig>;
  adapterId?: string;
  adapterName?: string;
};

export type CreateAsyncStorageAdapterOptions =
  | SingleStorageOptions
  | MultiStorageOptions;

const toStorageNode = (
  storageId: string,
  config: AsyncStorageLike | AsyncStorageInstanceConfig,
  fallbackName?: string,
  fallbackBlacklist?: RegExp
): StorageNode => {
  const resolved =
    'storage' in config
      ? config
      : {
          storage: config,
        };

  const { storage, name, blacklist } = resolved;

  return {
    id: storageId,
    name: name ?? fallbackName ?? storageId,
    blacklist: blacklist ?? fallbackBlacklist,
    capabilities: {
      supportedTypes: ['string'],
    },
    storage: {
      kind: 'async',
      getAllKeys: () => storage.getAllKeys(),
      get: async (key) => {
        const value = await storage.getItem(key);
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
          throw new Error('AsyncStorage adapter supports only string values.');
        }

        await storage.setItem(entry.key, entry.value);
      },
      delete: (key) => storage.removeItem(key),
    },
  };
};

export const createAsyncStorageAdapter = (
  options: CreateAsyncStorageAdapterOptions
): StorageAdapter => {
  const { adapterId = 'async-storage', adapterName = 'AsyncStorage' } =
    options;

  const storageNodes: StorageNode[] =
    'storages' in options
      ? Object.entries(options.storages).map(([storageId, config]) =>
          toStorageNode(storageId, config)
        )
      : [
          toStorageNode(
            options.storageId ?? 'default',
            options.storage,
            options.storageName ?? 'Default Storage',
            options.blacklist
          ),
        ];

  return {
    id: adapterId,
    name: adapterName,
    storages: storageNodes,
  };
};

/**
 * @deprecated Use createAsyncStorageAdapter instead.
 */
export const createExpoAsyncStorageAdapter = createAsyncStorageAdapter;
export type CreateExpoAsyncStorageAdapterOptions = CreateAsyncStorageAdapterOptions;
