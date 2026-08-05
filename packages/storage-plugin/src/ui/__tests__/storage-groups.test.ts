import { describe, expect, it } from 'vitest';
import {
  buildStorageSidebarGroups,
  parseStorageViewId,
  type StorageSnapshotEntry,
} from '../storage-groups';

const entry = (
  adapterId: string,
  storageId: string,
  adapterName: string,
  storageName: string,
  entryCount: number,
): StorageSnapshotEntry => ({
  target: { adapterId, storageId },
  adapterName,
  storageName,
  entryCount,
});

describe('buildStorageSidebarGroups', () => {
  it('groups snapshots by adapterId, using adapterName as the group label', () => {
    const snapshots = new Map([
      ['mmkv:default', entry('mmkv', 'default', 'MMKV', 'default', 3)],
      ['mmkv:user', entry('mmkv', 'user', 'MMKV', 'user', 1)],
      [
        'async-storage:default',
        entry('async-storage', 'default', 'AsyncStorage', 'default', 5),
      ],
    ]);

    expect(buildStorageSidebarGroups(snapshots)).toEqual([
      {
        adapterId: 'mmkv',
        adapterName: 'MMKV',
        items: [
          { viewId: 'mmkv:default', storageName: 'default', entryCount: 3 },
          { viewId: 'mmkv:user', storageName: 'user', entryCount: 1 },
        ],
      },
      {
        adapterId: 'async-storage',
        adapterName: 'AsyncStorage',
        items: [
          {
            viewId: 'async-storage:default',
            storageName: 'default',
            entryCount: 5,
          },
        ],
      },
    ]);
  });

  it('preserves insertion order of both groups and items within a group', () => {
    const snapshots = new Map([
      ['b:1', entry('b', '1', 'B', '1', 0)],
      ['a:1', entry('a', '1', 'A', '1', 0)],
      ['b:2', entry('b', '2', 'B', '2', 0)],
    ]);

    const groups = buildStorageSidebarGroups(snapshots);

    expect(groups.map((g) => g.adapterId)).toEqual(['b', 'a']);
    expect(groups[0].items.map((i) => i.viewId)).toEqual(['b:1', 'b:2']);
  });

  it('returns an empty array for an empty map', () => {
    expect(buildStorageSidebarGroups(new Map())).toEqual([]);
  });
});

describe('parseStorageViewId', () => {
  it('splits at the first colon', () => {
    expect(parseStorageViewId('mmkv:default')).toEqual({
      adapterId: 'mmkv',
      storageId: 'default',
    });
  });

  it('treats any further colons as part of the storageId', () => {
    expect(parseStorageViewId('mmkv:namespace:default')).toEqual({
      adapterId: 'mmkv',
      storageId: 'namespace:default',
    });
  });

  it('returns null when there is no colon', () => {
    expect(parseStorageViewId('invalid')).toBeNull();
  });
});
