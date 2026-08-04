import type {
  StorageCapabilities,
  StorageDescriptor,
  StorageEntry,
  StorageTarget,
} from './types';

export type SerializedBlacklist = {
  source: string;
  flags: string;
};

export type StorageSnapshotEvent = {
  type: 'snapshot';
  target: StorageTarget;
  adapterName: string;
  storageName: string;
  capabilities: StorageCapabilities;
  blacklist?: SerializedBlacklist;
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
  target: StorageTarget;
};

export type StorageDiscoverStoragesRequestEvent = {
  type: 'discover-storages';
  requestId: string;
};

export type StorageDiscoverStoragesResponseEvent = {
  type: 'storage-descriptors';
  requestId: string;
  storages: StorageDescriptor[];
};

export type StorageRequestError = {
  requestId: string;
  code:
    | 'TARGET_NOT_FOUND'
    | 'ENTRY_NOT_FOUND'
    | 'INVALID_CURSOR'
    | 'INVALID_REQUEST'
    | 'READ_FAILED'
    | 'WRITE_FAILED';
  message: string;
  resetPagination?: boolean;
};

export type StorageRequestErrorEvent = StorageRequestError & {
  type: 'storage-request-error';
};

export type StorageImportEntriesEvent = {
  type: 'import-entries';
  target: StorageTarget;
  entries: StorageEntry[];
};

export type StorageImportResultEvent = {
  type: 'import-result';
  target: StorageTarget;
  ok: boolean;
  written: number;
  total: number;
  failedKey?: string;
  error?: string;
};

export type StorageEvent =
  | StorageSnapshotEvent
  | StorageSetEntryEvent
  | StorageDeleteEntryEvent
  | StorageGetSnapshotEvent
  | StorageDiscoverStoragesRequestEvent
  | StorageDiscoverStoragesResponseEvent
  | StorageRequestErrorEvent
  | StorageImportEntriesEvent
  | StorageImportResultEvent;

export type StorageEventMap = {
  [K in StorageEvent['type']]: Extract<StorageEvent, { type: K }>;
};
