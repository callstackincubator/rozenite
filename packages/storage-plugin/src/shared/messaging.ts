import type { StorageCapabilities, StorageEntry, StorageTarget } from './types';

export type StorageSnapshotEvent = {
  type: 'snapshot';
  target: StorageTarget;
  adapterName: string;
  storageName: string;
  capabilities: StorageCapabilities;
  entries: StorageEntry[];
};

export type StorageSetEntryEvent = {
  type: 'set-entry';
  target: StorageTarget;
  entry: StorageEntry;
};

export type StorageDeleteEntryEvent = {
  type: 'delete-entry';
  target: StorageTarget;
  key: string;
};

export type StorageGetSnapshotEvent = {
  type: 'get-snapshot';
  target: StorageTarget | 'all';
};

export type StorageEvent =
  | StorageSnapshotEvent
  | StorageSetEntryEvent
  | StorageDeleteEntryEvent
  | StorageGetSnapshotEvent;

export type StorageEventMap = {
  [K in StorageEvent['type']]: Extract<StorageEvent, { type: K }>;
};
