import type {
  StorageGetEntryRequestEvent,
  StorageGetEntryResponseEvent,
  StorageRequestErrorEvent,
} from '../shared/messaging';
import type { StorageTarget } from '../shared/types';
import type { StorageView } from './storage-view';

type FullEntryResult = StorageGetEntryResponseEvent | StorageRequestErrorEvent;

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
): payload is StorageGetEntryRequestEvent =>
  typeof payload === 'object' &&
  payload != null &&
  !Array.isArray(payload) &&
  (payload as { type?: unknown }).type === 'get-entry' &&
  typeof (payload as { requestId?: unknown }).requestId === 'string' &&
  (payload as { requestId: string }).requestId.trim().length > 0 &&
  isTarget((payload as { target?: unknown }).target) &&
  typeof (payload as { key?: unknown }).key === 'string';

export const handleFullEntryRequest = async (
  views: readonly StorageView[],
  payload: unknown,
): Promise<FullEntryResult> => {
  const requestId = getRequestId(payload);
  if (!validateRequest(payload)) {
    return {
      type: 'storage-request-error',
      requestId,
      code: 'INVALID_REQUEST',
      message:
        'Full entry requests require a valid target, request ID, and string key.',
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
    // StorageView applies the same blacklist policy used by preview requests.
    const entry = await view.get(payload.key);
    if (!entry) {
      return {
        type: 'storage-request-error',
        requestId,
        code: 'ENTRY_NOT_FOUND',
        message: 'The requested storage entry was not found.',
      };
    }

    return {
      type: 'entry',
      requestId,
      target: view.target,
      entry,
    };
  } catch {
    return {
      type: 'storage-request-error',
      requestId,
      code: 'READ_FAILED',
      message: 'Failed to read the requested storage entry.',
    };
  }
};
