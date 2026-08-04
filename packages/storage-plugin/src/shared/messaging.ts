import type {
  StorageCapabilities,
  StorageDescriptor,
  StorageEntry,
  StorageEntryPreview,
  StorageTarget,
} from './types';
import type { StorageSnapshotV1 } from './snapshot';

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

export type StorageListEntryPreviewsRequestEvent = {
  type: 'list-entry-previews';
  requestId: string;
  target: StorageTarget;
  search?: string;
  keySortDirection?: 'ascending' | 'descending';
  cursor?: string;
  limit: number;
};

export type StorageListEntryPreviewsResponseEvent = {
  type: 'entry-previews';
  requestId: string;
  target: StorageTarget;
  items: StorageEntryPreview[];
  nextCursor?: string;
  previousCursor?: string;
};

export type StorageGetEntryRequestEvent = {
  type: 'get-entry';
  requestId: string;
  target: StorageTarget;
  key: string;
};

export type StorageGetEntryResponseEvent = {
  type: 'entry';
  requestId: string;
  target: StorageTarget;
  entry: StorageEntry;
};

export type StorageExportSnapshotRequestEvent = {
  type: 'export-snapshot';
  requestId: string;
  target: StorageTarget;
};

export type StorageExportSnapshotResponseEvent = {
  type: 'export-snapshot-result';
  requestId: string;
  target: StorageTarget;
  snapshot: StorageSnapshotV1;
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
  | StorageListEntryPreviewsRequestEvent
  | StorageListEntryPreviewsResponseEvent
  | StorageGetEntryRequestEvent
  | StorageGetEntryResponseEvent
  | StorageExportSnapshotRequestEvent
  | StorageExportSnapshotResponseEvent
  | StorageRequestErrorEvent
  | StorageImportEntriesEvent
  | StorageImportResultEvent;

export type StorageEventMap = {
  [K in StorageEvent['type']]: Extract<StorageEvent, { type: K }>;
};
