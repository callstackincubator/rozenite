import type { MMKV as MMKVV3 } from 'react-native-mmkv-v3';
import type { MMKV as MMKVV4 } from 'react-native-mmkv-v4';
import type {
  StorageAdapter,
  StorageEntry,
  StorageNode,
} from '../../shared/types';
import { DEFAULT_SUPPORTED_TYPES } from '../../shared/types';

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

// MMKV's typed getters can disagree on the same key — on some platforms
// `getString` lenient-decodes invalid-UTF-8 buffer bytes to `""`, and
// `getNumber` reinterprets 8-byte buffers as IEEE 754 doubles without
// honoring the original `setBuffer` write. `getBuffer` is more reliably
// strict (only returns for keys actually written via `setBuffer`), so
// we consult it ahead of the numeric getters to break ties in favour of
// the bytes that are actually on disk.
//
//   1. Non-empty string — the common case. Buffer bytes that happen to
//      be valid UTF-8 surface here too (documented trade-off); users
//      disambiguate at edit time via the Hex editor.
//   2. Non-empty buffer — catches `setBuffer` payloads regardless of
//      byte count and regardless of whether the other typed getters
//      also return spurious values.
//   3. Number, then boolean — for keys actually written via `setNumber`
//      / `setBoolean`. `getBuffer` will have returned `undefined` for
//      those keys, so the chain falls through.
//   4. Empty string — intentional `setString(key, "")` lands here once
//      we've ruled out a non-empty buffer payload at the same key.
const getEntry = (
  adapter: MMKVAdapter,
  key: string,
): StorageEntry | undefined => {
  const stringValue = adapter.getString(key);
  if (stringValue !== undefined && stringValue.length > 0) {
    return { key, type: 'string', value: stringValue };
  }

  const bufferValue = adapter.getBuffer(key);
  if (bufferValue !== undefined && bufferValue.byteLength > 0) {
    return {
      key,
      type: 'buffer',
      value: Array.from(new Uint8Array(bufferValue)),
    };
  }

  const numberValue = adapter.getNumber(key);
  if (numberValue !== undefined) {
    return { key, type: 'number', value: numberValue };
  }

  const booleanValue = adapter.getBoolean(key);
  if (booleanValue !== undefined) {
    return { key, type: 'boolean', value: booleanValue };
  }

  if (stringValue !== undefined) {
    return { key, type: 'string', value: stringValue };
  }

  return undefined;
};

const setEntry = (adapter: MMKVAdapter, entry: StorageEntry) => {
  if (entry.type === 'buffer') {
    adapter.set(entry.key, new Uint8Array(entry.value).buffer);
  } else {
    adapter.set(entry.key, entry.value);
  }
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
          get: (key) => getEntry(mmkv, key),
          set: (entry) => setEntry(mmkv, entry),
          delete: (key) => mmkv.delete(key),
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
