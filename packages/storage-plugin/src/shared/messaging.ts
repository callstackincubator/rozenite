import type { StorageDescriptor, StorageEntry, StorageEntryPreview, StorageTarget } from './types';
import type { ImportPreview, StorageSnapshotV1 } from './snapshot';

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

export type StoragePurgeEvent = {
  type: 'purge-storage';
  target: StorageTarget;
};

export type StorageInvalidationOperation = 'set' | 'delete' | 'import' | 'purge';

export type StorageInvalidatedEvent = {
  type: 'storage-invalidated';
  target: StorageTarget;
  /** Native subscriptions only expose a key, not the operation. */
  key?: string;
  operation?: StorageInvalidationOperation;
  /** Updated entry count for the storage after the invalidation. */
  entryCount: number;
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

export type StorageImportPreviewRequestEvent = {
  type: 'preview-import';
  requestId: string;
  target: StorageTarget;
  snapshot: StorageSnapshotV1;
};

export type StorageImportPreviewResponseEvent = {
  type: 'import-preview';
  requestId: string;
  target: StorageTarget;
  preview: ImportPreview;
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
  requestId: string;
  target: StorageTarget;
  entries: StorageEntry[];
};

export type StorageImportProgressEvent = {
  type: 'import-progress';
  requestId: string;
  target: StorageTarget;
  written: number;
  total: number;
};

export type StorageImportResultEvent = {
  type: 'import-result';
  requestId: string;
  target: StorageTarget;
  ok: boolean;
  written: number;
  total: number;
  failedKey?: string;
  error?: string;
};

export type StorageEvent =
  | StorageSetEntryEvent
  | StorageDeleteEntryEvent
  | StoragePurgeEvent
  | StorageInvalidatedEvent
  | StorageDiscoverStoragesRequestEvent
  | StorageDiscoverStoragesResponseEvent
  | StorageListEntryPreviewsRequestEvent
  | StorageListEntryPreviewsResponseEvent
  | StorageGetEntryRequestEvent
  | StorageGetEntryResponseEvent
  | StorageExportSnapshotRequestEvent
  | StorageExportSnapshotResponseEvent
  | StorageImportPreviewRequestEvent
  | StorageImportPreviewResponseEvent
  | StorageRequestErrorEvent
  | StorageImportEntriesEvent
  | StorageImportProgressEvent
  | StorageImportResultEvent;

export type StorageEventMap = {
  [K in StorageEvent['type']]: Extract<StorageEvent, { type: K }>;
};
