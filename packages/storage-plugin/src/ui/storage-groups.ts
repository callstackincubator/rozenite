import type { StorageTarget } from '../shared/types';

export type StorageSnapshotEntry = {
  target: StorageTarget;
  adapterName: string;
  storageName: string;
  entryCount: number;
};

export type StorageSidebarItem = {
  viewId: string;
  storageName: string;
  entryCount: number;
};

export type StorageSidebarGroup = {
  adapterId: string;
  adapterName: string;
  items: StorageSidebarItem[];
};

/**
 * Groups storage snapshots by `target.adapterId` for the sidebar, preserving
 * the order in which each adapter and storage first appeared.
 */
export const buildStorageSidebarGroups = (
  snapshots: Map<string, StorageSnapshotEntry>,
): StorageSidebarGroup[] => {
  const groups = new Map<string, StorageSidebarGroup>();

  for (const [viewId, snapshot] of snapshots) {
    const { adapterId } = snapshot.target;
    let group = groups.get(adapterId);

    if (!group) {
      group = { adapterId, adapterName: snapshot.adapterName, items: [] };
      groups.set(adapterId, group);
    }

    group.items.push({
      viewId,
      storageName: snapshot.storageName,
      entryCount: snapshot.entryCount,
    });
  }

  return [...groups.values()];
};

/**
 * Splits a storage view id (`${adapterId}:${storageId}`) back into its
 * target, using the first `:` as the separator since `storageId` may itself
 * contain colons. Returns `null` for a malformed id.
 */
export const parseStorageViewId = (viewId: string): StorageTarget | null => {
  const separatorIndex = viewId.indexOf(':');

  if (separatorIndex < 0) {
    return null;
  }

  return {
    adapterId: viewId.slice(0, separatorIndex),
    storageId: viewId.slice(separatorIndex + 1),
  };
};
