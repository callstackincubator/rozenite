import {
  getStorageViewId,
  supportsType,
  type AsyncStorage,
  type StorageAdapter,
  type StorageCapabilities,
  type StorageEntry,
  type StorageEntryType,
  type StorageNode,
  type StorageSubscription,
  type StorageTarget,
  type SyncStorage,
} from '../shared/types';

type AsyncStorageLike = SyncStorage | AsyncStorage;

const isAsyncStorage = (storage: AsyncStorageLike): storage is AsyncStorage =>
  storage.kind === 'async';

const shouldFilterKey = (storage: StorageNode, key: string) => {
  if (storage.shouldFilterKey?.(key)) {
    return true;
  }

  if (!storage.blacklist) {
    return false;
  }

  storage.blacklist.lastIndex = 0;
  return storage.blacklist.test(key);
};

const checkTypeSupport = (
  capabilities: StorageCapabilities,
  type: StorageEntryType,
  target: StorageTarget,
) => {
  if (supportsType(capabilities, type)) {
    return;
  }

  throw new Error(
    `Type "${type}" is not supported by storage "${target.storageId}" in adapter "${target.adapterId}".`,
  );
};

const getAllKeys = async (storage: AsyncStorageLike) => {
  if (isAsyncStorage(storage)) {
    return storage.getAllKeys();
  }

  return storage.getAllKeys();
};

const getEntry = async (storage: AsyncStorageLike, key: string) => {
  if (isAsyncStorage(storage)) {
    return storage.get(key);
  }

  return storage.get(key);
};

const setEntry = async (storage: AsyncStorageLike, entry: StorageEntry) => {
  if (isAsyncStorage(storage)) {
    await storage.set(entry);
    return;
  }

  storage.set(entry);
};

const deleteEntry = async (storage: AsyncStorageLike, key: string) => {
  if (isAsyncStorage(storage)) {
    await storage.delete(key);
    return;
  }

  storage.delete(key);
};

export type StorageView = {
  id: string;
  target: StorageTarget;
  adapterName: string;
  storageName: string;
  capabilities: StorageCapabilities;
  supportsSubscriptions: boolean;
  blacklist?: RegExp;
  get: (key: string) => Promise<StorageEntry | undefined>;
  set: (entry: StorageEntry) => Promise<void>;
  delete: (key: string) => Promise<void>;
  getAllKeys: () => Promise<readonly string[]>;
  getAllEntries: () => Promise<StorageEntry[]>;
  watch?: (callbacks: {
    onSet: (entry: StorageEntry) => void;
    onDelete: (key: string) => void;
  }) => Promise<StorageSubscription>;
};

export const createStorageView = (
  adapter: StorageAdapter,
  storageNode: StorageNode,
): StorageView => {
  const storage = storageNode.storage;
  const subscribe = storage.subscribe;
  const target: StorageTarget = {
    adapterId: adapter.id,
    storageId: storageNode.id,
  };

  const get = async (key: string) => {
    if (shouldFilterKey(storageNode, key)) {
      return undefined;
    }

    return getEntry(storage, key);
  };

  const getAllEntries = async () => {
    const keys = await getAllKeys(storage);
    const visibleEntries = await Promise.all(
      keys
        .filter((key) => !shouldFilterKey(storageNode, key))
        .map((key) => getEntry(storage, key)),
    );

    return visibleEntries.filter((entry): entry is StorageEntry => !!entry);
  };

  return {
    id: getStorageViewId(target),
    target,
    adapterName: adapter.name,
    storageName: storageNode.name,
    capabilities: storageNode.capabilities,
    supportsSubscriptions: subscribe != null,
    blacklist: storageNode.blacklist,
    get,
    set: async (entry) => {
      checkTypeSupport(storageNode.capabilities, entry.type, target);
      await setEntry(storage, entry);
    },
    delete: async (key) => {
      await deleteEntry(storage, key);
    },
    getAllKeys: async () => {
      const keys = await getAllKeys(storage);
      return keys.filter((key) => !shouldFilterKey(storageNode, key));
    },
    getAllEntries,
    ...(subscribe
      ? {
          watch: async ({ onSet, onDelete }) =>
            subscribe(async (key) => {
              try {
                const entry = await get(key);

                if (!entry) {
                  onDelete(key);
                  return;
                }

                onSet(entry);
              } catch {
                // Ignore runtime callback errors from native subscriptions.
              }
            }),
        }
      : {}),
  };
};

export const createStorageViews = (storages: StorageAdapter[]) =>
  storages.flatMap((adapter) =>
    adapter.storages.map((storageNode) =>
      createStorageView(adapter, storageNode),
    ),
  );
