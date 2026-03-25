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

const POLLING_INTERVAL_MS = 1500;

type StorageSnapshotMap = Map<string, StorageEntry>;

type AsyncStorageLike = SyncStorage | AsyncStorage;

const isAsyncStorage = (storage: AsyncStorageLike): storage is AsyncStorage =>
  storage.kind === 'async';

const fingerprintEntry = (entry: StorageEntry) => {
  if (entry.type === 'buffer') {
    return `${entry.type}:${entry.value.join(',')}`;
  }

  return `${entry.type}:${String(entry.value)}`;
};

const toSnapshotMap = (entries: StorageEntry[]) => {
  return new Map(entries.map((entry) => [entry.key, entry]));
};

const shouldFilterKey = (storage: StorageNode, key: string) => {
  if (!storage.blacklist) {
    return false;
  }

  storage.blacklist.lastIndex = 0;
  return storage.blacklist.test(key);
};

const checkTypeSupport = (
  capabilities: StorageCapabilities,
  type: StorageEntryType,
  target: StorageTarget
) => {
  if (supportsType(capabilities, type)) {
    return;
  }

  throw new Error(
    `Type "${type}" is not supported by storage "${target.storageId}" in adapter "${target.adapterId}".`
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
  get: (key: string) => Promise<StorageEntry | undefined>;
  set: (entry: StorageEntry) => Promise<void>;
  delete: (key: string) => Promise<void>;
  getAllKeys: () => Promise<readonly string[]>;
  getAllEntries: () => Promise<StorageEntry[]>;
  watch: (callbacks: {
    onSet: (entry: StorageEntry) => void;
    onDelete: (key: string) => void;
  }) => Promise<StorageSubscription>;
};

const buildSnapshotMap = async (
  getAllEntries: () => Promise<StorageEntry[]>
): Promise<StorageSnapshotMap> => {
  const entries = await getAllEntries();
  return toSnapshotMap(entries);
};

const diffSnapshots = (
  previous: StorageSnapshotMap,
  next: StorageSnapshotMap,
  handlers: {
    onSet: (entry: StorageEntry) => void;
    onDelete: (key: string) => void;
  }
) => {
  next.forEach((nextEntry, key) => {
    const previousEntry = previous.get(key);

    if (!previousEntry) {
      handlers.onSet(nextEntry);
      return;
    }

    if (fingerprintEntry(previousEntry) !== fingerprintEntry(nextEntry)) {
      handlers.onSet(nextEntry);
    }
  });

  previous.forEach((_value, key) => {
    if (!next.has(key)) {
      handlers.onDelete(key);
    }
  });
};

const createPollingSubscription = async (
  getAllEntries: () => Promise<StorageEntry[]>,
  handlers: {
    onSet: (entry: StorageEntry) => void;
    onDelete: (key: string) => void;
  }
): Promise<StorageSubscription> => {
  let previousSnapshot = await buildSnapshotMap(getAllEntries);

  const interval = setInterval(async () => {
    try {
      const nextSnapshot = await buildSnapshotMap(getAllEntries);
      diffSnapshots(previousSnapshot, nextSnapshot, handlers);
      previousSnapshot = nextSnapshot;
    } catch {
      // Silently ignore polling errors and try again on next tick.
    }
  }, POLLING_INTERVAL_MS);

  return {
    remove: () => {
      clearInterval(interval);
    },
  };
};

export const createStorageView = (
  adapter: StorageAdapter,
  storageNode: StorageNode
): StorageView => {
  const storage = storageNode.storage;
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
        .map((key) => getEntry(storage, key))
    );

    return visibleEntries.filter((entry): entry is StorageEntry => !!entry);
  };

  return {
    id: getStorageViewId(target),
    target,
    adapterName: adapter.name,
    storageName: storageNode.name,
    capabilities: storageNode.capabilities,
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
    watch: async ({ onSet, onDelete }) => {
      if (storage.subscribe) {
        return storage.subscribe(async (key) => {
          try {
            const entry = await get(key);

            if (!entry) {
              onDelete(key);
              return;
            }

            onSet(entry);
          } catch {
            // Ignore runtime callback errors; polling fallback is not needed when subscribe exists.
          }
        });
      }

      return createPollingSubscription(getAllEntries, { onSet, onDelete });
    },
  };
};

export const createStorageViews = (storages: StorageAdapter[]) =>
  storages.flatMap((adapter) =>
    adapter.storages.map((storageNode) => createStorageView(adapter, storageNode))
  );
