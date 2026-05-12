import type { MMKV as MMKVV3 } from 'react-native-mmkv-v3';
import type { MMKV as MMKVV4 } from 'react-native-mmkv-v4';
import type {
  StorageAdapter,
  StorageEntry,
  StorageEntryType,
  StorageNode,
} from '../../shared/types';
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
        '[Rozenite] Storage Plugin: MMKV arrays are not supported for v4 storages. Pass a record of storage IDs and MMKV instances.',
      );
    }

    return Object.fromEntries(
      (storages as MMKVV3[]).map((storage) => [storage['id'], storage]),
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
    addOnValueChangedListener: (callback) =>
      mmkv.addOnValueChangedListener(callback),
  };
};

// Per-storage map of "known" types for keys we have observed via set().
// MMKV stores raw bytes without a type tag: once a buffer is written,
// getString() on the same key happily decodes those bytes as UTF-8.
// For buffers that happen to be valid printable ASCII (e.g. "hello")
// the heuristic below cannot tell buffer from string. This map lets us
// honor the type the plugin (or the app, on first observation) intended
// for the round-trip case (edit → save → re-read).
type TypeOverrideMap = Map<string, StorageEntryType>;

const readWithType = (
  adapter: MMKVAdapter,
  key: string,
  type: StorageEntryType,
): StorageEntry | undefined => {
  switch (type) {
    case 'string': {
      const value = adapter.getString(key);
      return value !== undefined ? { key, type: 'string', value } : undefined;
    }
    case 'number': {
      const value = adapter.getNumber(key);
      return value !== undefined ? { key, type: 'number', value } : undefined;
    }
    case 'boolean': {
      const value = adapter.getBoolean(key);
      return value !== undefined ? { key, type: 'boolean', value } : undefined;
    }
    case 'buffer': {
      const value = adapter.getBuffer(key);
      return value !== undefined
        ? { key, type: 'buffer', value: Array.from(new Uint8Array(value)) }
        : undefined;
    }
  }
};

const getEntry = (
  adapter: MMKVAdapter,
  key: string,
  typeOverrides: TypeOverrideMap,
): StorageEntry | undefined => {
  const override = typeOverrides.get(key);
  if (override) {
    const entry = readWithType(adapter, key, override);
    if (entry) {
      return entry;
    }
    // The key was deleted (or the typed getter no longer resolves) — drop
    // the stale override and fall through to the heuristic.
    typeOverrides.delete(key);
  }

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

const setEntry = (
  adapter: MMKVAdapter,
  entry: StorageEntry,
  typeOverrides: TypeOverrideMap,
) => {
  if (entry.type === 'buffer') {
    adapter.set(entry.key, new Uint8Array(entry.value).buffer);
  } else {
    adapter.set(entry.key, entry.value);
  }
  typeOverrides.set(entry.key, entry.type);
};

const deleteKey = (
  adapter: MMKVAdapter,
  key: string,
  typeOverrides: TypeOverrideMap,
) => {
  adapter.delete(key);
  typeOverrides.delete(key);
};

const getStorageBlacklist = (
  config: MMKVBlacklistConfig | undefined,
  storageId: string,
) => {
  if (!config) {
    return undefined;
  }

  if (config instanceof RegExp) {
    return config;
  }

  return config[storageId];
};

const createStorageBlacklistMatcher = (
  config: MMKVBlacklistConfig | undefined,
  storageId: string,
) => {
  if (!(config instanceof RegExp)) {
    return undefined;
  }

  return (key: string) => {
    config.lastIndex = 0;
    return config.test(`${storageId}:${key}`);
  };
};

export const createMMKVStorageAdapter = ({
  adapterId = 'mmkv',
  adapterName = 'MMKV',
  storages,
  blacklist,
}: CreateMMKVStorageAdapterOptions): StorageAdapter => {
  const normalizedStorages = normalizeStorages(storages) as Record<
    string,
    MMKV
  >;

  const storageNodes: StorageNode[] = Object.entries(normalizedStorages).map(
    ([storageId, storage]) => {
      const mmkv = getMMKVAdapter(storage);
      const typeOverrides: TypeOverrideMap = new Map();

      return {
        id: storageId,
        name: storageId,
        blacklist: getStorageBlacklist(blacklist, storageId),
        shouldFilterKey: createStorageBlacklistMatcher(blacklist, storageId),
        capabilities: {
          supportedTypes: DEFAULT_SUPPORTED_TYPES,
        },
        storage: {
          kind: 'sync',
          getAllKeys: () => mmkv.getAllKeys(),
          get: (key) => getEntry(mmkv, key, typeOverrides),
          set: (entry) => setEntry(mmkv, entry, typeOverrides),
          delete: (key) => deleteKey(mmkv, key, typeOverrides),
          subscribe: (callback) => mmkv.addOnValueChangedListener(callback),
        },
      };
    },
  );

  return {
    id: adapterId,
    name: adapterName,
    storages: storageNodes,
  };
};
