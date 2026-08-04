import type {
  StorageImportEntriesEvent,
  StorageImportPreviewRequestEvent,
  StorageImportPreviewResponseEvent,
  StorageImportProgressEvent,
  StorageImportResultEvent,
  StorageRequestErrorEvent,
} from '../shared/messaging';
import { computePreview, parseSnapshot } from '../shared/snapshot';
import {
  supportsType,
  type StorageEntry,
  type StorageTarget,
} from '../shared/types';
import type { StorageView } from './storage-view';

export type ImportEmittedEvent =
  | StorageImportProgressEvent
  | StorageImportResultEvent;

type ImportPreviewResult =
  | StorageImportPreviewResponseEvent
  | StorageRequestErrorEvent;

const isSameTarget = (left: StorageTarget, right: StorageTarget) =>
  left.adapterId === right.adapterId && left.storageId === right.storageId;

const isTarget = (value: unknown): value is StorageTarget =>
  typeof value === 'object' &&
  value != null &&
  !Array.isArray(value) &&
  typeof (value as { adapterId?: unknown }).adapterId === 'string' &&
  (value as { adapterId: string }).adapterId.trim().length > 0 &&
  typeof (value as { storageId?: unknown }).storageId === 'string' &&
  (value as { storageId: string }).storageId.trim().length > 0;

const getRequestId = (payload: unknown) =>
  typeof payload === 'object' &&
  payload != null &&
  !Array.isArray(payload) &&
  typeof (payload as { requestId?: unknown }).requestId === 'string'
    ? (payload as { requestId: string }).requestId
    : '';

const isEntry = (value: unknown): value is StorageEntry => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return false;
  }

  const entry = value as { key?: unknown; type?: unknown; value?: unknown };
  if (typeof entry.key !== 'string') return false;
  if (entry.type === 'string') return typeof entry.value === 'string';
  if (entry.type === 'number') return typeof entry.value === 'number';
  if (entry.type === 'boolean') return typeof entry.value === 'boolean';
  return (
    entry.type === 'buffer' &&
    Array.isArray(entry.value) &&
    entry.value.every(
      (byte) =>
        typeof byte === 'number' &&
        Number.isInteger(byte) &&
        byte >= 0 &&
        byte <= 255,
    )
  );
};

const isBlacklisted = (view: StorageView, key: string) => {
  if (!view.blacklist) return false;
  view.blacklist.lastIndex = 0;
  return view.blacklist.test(key);
};

const findView = (views: readonly StorageView[], target: StorageTarget) =>
  views.find((candidate) => isSameTarget(candidate.target, target));

export const handleImportPreviewRequest = async (
  views: readonly StorageView[],
  payload: unknown,
): Promise<ImportPreviewResult> => {
  const requestId = getRequestId(payload);
  const request = payload as Partial<StorageImportPreviewRequestEvent>;
  const parsedSnapshot = parseSnapshot(request.snapshot);
  if (
    typeof request !== 'object' ||
    request == null ||
    request.type !== 'preview-import' ||
    typeof request.requestId !== 'string' ||
    request.requestId.trim().length === 0 ||
    !isTarget(request.target) ||
    !parsedSnapshot.ok
  ) {
    return {
      type: 'storage-request-error',
      requestId,
      code: 'INVALID_REQUEST',
      message:
        'Import preview requests require a valid target, request ID, and snapshot.',
    };
  }

  const view = findView(views, request.target);
  if (!view) {
    return {
      type: 'storage-request-error',
      requestId,
      code: 'TARGET_NOT_FOUND',
      message: 'The requested storage target was not found.',
    };
  }

  try {
    const entryKeys = new Set(await view.getAllKeys());
    return {
      type: 'import-preview',
      requestId,
      target: view.target,
      preview: computePreview(parsedSnapshot.snapshot, {
        target: view.target,
        capabilities: view.capabilities,
        entryKeys,
        isBlacklisted: (key) => isBlacklisted(view, key),
      }),
    };
  } catch {
    return {
      type: 'storage-request-error',
      requestId,
      code: 'READ_FAILED',
      message: 'Failed to inspect the requested storage for import.',
    };
  }
};

export const handleImportEntries = async (
  views: StorageView[],
  payload: unknown,
  emit: (out: ImportEmittedEvent) => void,
): Promise<void> => {
  const requestId = getRequestId(payload);
  const event = payload as Partial<StorageImportEntriesEvent>;
  if (
    typeof event !== 'object' ||
    event == null ||
    event.type !== 'import-entries' ||
    typeof event.requestId !== 'string' ||
    event.requestId.trim().length === 0 ||
    !isTarget(event.target) ||
    !Array.isArray(event.entries) ||
    !event.entries.every(isEntry)
  ) {
    emit({
      type: 'import-result',
      requestId,
      target: isTarget(event.target)
        ? event.target
        : { adapterId: '', storageId: '' },
      ok: false,
      written: 0,
      total: 0,
      error: 'Import requests require a valid target, request ID, and entries.',
    });
    return;
  }

  const view = findView(views, event.target);

  if (!view) {
    emit({
      type: 'import-result',
      requestId: event.requestId,
      target: event.target,
      ok: false,
      written: 0,
      total: event.entries.length,
      error: 'Target storage not found',
    });
    return;
  }

  // Recheck policy at apply time so a preview cannot bypass a changed target.
  const entries = event.entries.filter(
    (entry) =>
      supportsType(view.capabilities, entry.type) &&
      !isBlacklisted(view, entry.key),
  );

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    try {
      await view.set(entry);
    } catch (error) {
      emit({
        type: 'import-result',
        requestId: event.requestId,
        target: event.target,
        ok: false,
        written: i,
        total: entries.length,
        failedKey: entry.key,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    emit({
      type: 'import-progress',
      requestId: event.requestId,
      target: event.target,
      written: i + 1,
      total: entries.length,
    });
  }

  emit({
    type: 'import-result',
    requestId: event.requestId,
    target: event.target,
    ok: true,
    written: entries.length,
    total: entries.length,
  });
};
