import { buildSnapshot } from '../shared/snapshot';
import type {
  StorageExportSnapshotRequestEvent,
  StorageExportSnapshotResponseEvent,
  StorageRequestErrorEvent,
} from '../shared/messaging';
import type { StorageTarget } from '../shared/types';
import type { StorageView } from './storage-view';

type ExportSnapshotResult =
  | StorageExportSnapshotResponseEvent
  | StorageRequestErrorEvent;

const getRequestId = (payload: unknown) =>
  typeof payload === 'object' &&
  payload != null &&
  !Array.isArray(payload) &&
  typeof (payload as { requestId?: unknown }).requestId === 'string'
    ? (payload as { requestId: string }).requestId
    : '';

const isTarget = (value: unknown): value is StorageTarget =>
  typeof value === 'object' &&
  value != null &&
  !Array.isArray(value) &&
  typeof (value as { adapterId?: unknown }).adapterId === 'string' &&
  (value as { adapterId: string }).adapterId.trim().length > 0 &&
  typeof (value as { storageId?: unknown }).storageId === 'string' &&
  (value as { storageId: string }).storageId.trim().length > 0;

const isSameTarget = (left: StorageTarget, right: StorageTarget) =>
  left.adapterId === right.adapterId && left.storageId === right.storageId;

const validateRequest = (
  payload: unknown,
): payload is StorageExportSnapshotRequestEvent =>
  typeof payload === 'object' &&
  payload != null &&
  !Array.isArray(payload) &&
  (payload as { type?: unknown }).type === 'export-snapshot' &&
  typeof (payload as { requestId?: unknown }).requestId === 'string' &&
  (payload as { requestId: string }).requestId.trim().length > 0 &&
  isTarget((payload as { target?: unknown }).target);

export const handleExportSnapshotRequest = async (
  views: readonly StorageView[],
  payload: unknown,
): Promise<ExportSnapshotResult> => {
  const requestId = getRequestId(payload);
  if (!validateRequest(payload)) {
    return {
      type: 'storage-request-error',
      requestId,
      code: 'INVALID_REQUEST',
      message: 'Export requests require a valid target and request ID.',
    };
  }

  const view = views.find((candidate) =>
    isSameTarget(candidate.target, payload.target),
  );
  if (!view) {
    return {
      type: 'storage-request-error',
      requestId,
      code: 'TARGET_NOT_FOUND',
      message: 'The requested storage target was not found.',
    };
  }

  try {
    // getAllEntries applies the storage view's blacklist before reading values.
    const entries = await view.getAllEntries();
    return {
      type: 'export-snapshot-result',
      requestId,
      target: view.target,
      snapshot: buildSnapshot({
        target: view.target,
        adapterName: view.adapterName,
        storageName: view.storageName,
        capabilities: view.capabilities,
        entries,
      }),
    };
  } catch {
    return {
      type: 'storage-request-error',
      requestId,
      code: 'READ_FAILED',
      message: 'Failed to export the requested storage.',
    };
  }
};
