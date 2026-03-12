import type { MMKV as MMKVV3 } from 'react-native-mmkv-v3';
import type { MMKV as MMKVV4 } from 'react-native-mmkv-v4';
import type { StorageAdapter, StorageEntry, StorageNode } from '../../shared/types';
import { DEFAULT_SUPPORTED_TYPES } from '../../shared/types';
import { looksLikeGarbled } from '../is-garbled';

type MMKV = MMKVV3 | MMKVV4;

type MMKVAdapter = {
  set: (key: string, value: boolean | string | number | ArrayBuffer) => void;
  getBoolean: (key: string) => boolean | undefined;
  getString: (key: string) => string | undefined;
  getNumber: (key: string) => number | undefined;
  getBuffer: (key: string) => ArrayBuffer | undefined;
  delete: (key: string) => void;
  getAllKeys: () => string[];
  addOnValueChangedListener: (callback: (key: string) => void) => {
    remove: () => void;
  };
};

export type MMKVBlacklistConfig = RegExp | Record<string, RegExp | undefined>;

export type CreateMMKVStorageAdapterOptions = {
  adapterId?: string;
  adapterName?: string;
  storages: MMKV[] | Record<string, MMKV>;
  blacklist?: MMKVBlacklistConfig;
};

const isMMKVV4 = (mmkv: MMKV): mmkv is MMKVV4 => 'remove' in mmkv;

const normalizeStorages = (storages: MMKV[] | Record<string, MMKV>) => {
  if (Array.isArray(storages)) {
    const isAnyStorageV4 = storages.some(isMMKVV4);

    if (isAnyStorageV4) {
      throw new Error(
        '[Rozenite] Storage Plugin: MMKV arrays are not supported for v4 storages. Pass a record of storage IDs and MMKV instances.'
      );
    }

    return Object.fromEntries(
      (storages as MMKVV3[]).map((storage) => [storage['id'], storage])
    );
  }

  return storages;
};

const getMMKVAdapter = (mmkv: MMKV): MMKVAdapter => {
  if (isMMKVV4(mmkv)) {
    return {
      set: (key, value) => mmkv.set(key, value),
      getBoolean: (key) => mmkv.getBoolean(key),
      getString: (key) => mmkv.getString(key),
      getNumber: (key) => mmkv.getNumber(key),
      getBuffer: (key) => mmkv.getBuffer(key),
      delete: (key) => mmkv.remove(key),
      getAllKeys: () => mmkv.getAllKeys(),
      addOnValueChangedListener: (callback) =>
        mmkv.addOnValueChangedListener(callback),
    };
  }

  return {
    set: (key, value) => mmkv.set(key, value),
    getBoolean: (key) => mmkv.getBoolean(key),
    getString: (key) => mmkv.getString(key),
    getNumber: (key) => mmkv.getNumber(key),
    getBuffer: (key) => mmkv.getBuffer(key) as ArrayBuffer | undefined,
    delete: (key) => mmkv.delete(key),
    getAllKeys: () => mmkv.getAllKeys(),
    addOnValueChangedListener: (callback) => mmkv.addOnValueChangedListener(callback),
  };
};

const getEntry = (adapter: MMKVAdapter, key: string): StorageEntry | undefined => {
  const stringValue = adapter.getString(key);

  if (stringValue !== undefined && stringValue.length > 0) {
    if (looksLikeGarbled(stringValue)) {
      return {
        key,
        type: 'buffer',
        value: Array.from(new TextEncoder().encode(stringValue)),
      };
    }

    return {
      key,
      type: 'string',
      value: stringValue,
    };
  }

  const numberValue = adapter.getNumber(key);
  if (numberValue !== undefined) {
    return {
      key,
      type: 'number',
      value: numberValue,
    };
  }

  const booleanValue = adapter.getBoolean(key);
  if (booleanValue !== undefined) {
    return {
      key,
      type: 'boolean',
      value: booleanValue,
    };
  }

  const bufferValue = adapter.getBuffer(key);
  if (bufferValue !== undefined) {
    return {
      key,
      type: 'buffer',
      value: Array.from(new Uint8Array(bufferValue)),
    };
  }

  return undefined;
};

const setEntry = (adapter: MMKVAdapter, entry: StorageEntry) => {
  if (entry.type === 'buffer') {
    adapter.set(entry.key, new Uint8Array(entry.value).buffer);
    return;
  }

  adapter.set(entry.key, entry.value);
};

const getStorageBlacklist = (
  config: MMKVBlacklistConfig | undefined,
  storageId: string
) => {
  if (!config) {
    return undefined;
  }

  if (config instanceof RegExp) {
    return config;
  }

  return config[storageId];
};

export const createMMKVStorageAdapter = ({
  adapterId = 'mmkv',
  adapterName = 'MMKV',
  storages,
  blacklist,
}: CreateMMKVStorageAdapterOptions): StorageAdapter => {
  const normalizedStorages = normalizeStorages(storages) as Record<string, MMKV>;

  const storageNodes: StorageNode[] = Object.entries(normalizedStorages).map(
    ([storageId, storage]) => {
      const mmkv = getMMKVAdapter(storage);

      return {
        id: storageId,
        name: storageId,
        blacklist: getStorageBlacklist(blacklist, storageId),
        capabilities: {
          supportedTypes: DEFAULT_SUPPORTED_TYPES,
        },
        storage: {
          kind: 'sync',
          getAllKeys: () => mmkv.getAllKeys(),
          get: (key) => getEntry(mmkv, key),
          set: (entry) => setEntry(mmkv, entry),
          delete: (key) => mmkv.delete(key),
          subscribe: (callback) => mmkv.addOnValueChangedListener(callback),
        },
      };
    }
  );

  return {
    id: adapterId,
    name: adapterName,
    storages: storageNodes,
  };
};
