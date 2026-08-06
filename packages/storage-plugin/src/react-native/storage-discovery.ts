import type {
  StorageDiscoverStoragesRequestEvent,
  StorageDiscoverStoragesResponseEvent,
  StorageRequestErrorEvent,
} from '../shared/messaging';
import type { StorageDescriptor } from '../shared/types';
import type { StorageView } from './storage-view';

type DiscoveryResult = StorageDiscoverStoragesResponseEvent | StorageRequestErrorEvent;

const getRequestId = (payload: unknown) => {
  if (
    typeof payload === 'object' &&
    payload != null &&
    !Array.isArray(payload) &&
    typeof (payload as { requestId?: unknown }).requestId === 'string'
  ) {
    return (payload as { requestId: string }).requestId;
  }

  return '';
};

const validateRequest = (payload: unknown): payload is StorageDiscoverStoragesRequestEvent =>
  typeof payload === 'object' &&
  payload != null &&
  !Array.isArray(payload) &&
  (payload as { type?: unknown }).type === 'discover-storages' &&
  typeof (payload as { requestId?: unknown }).requestId === 'string' &&
  (payload as { requestId: string }).requestId.trim().length > 0;

const toDescriptor = async (view: StorageView): Promise<StorageDescriptor> => ({
  target: view.target,
  adapterName: view.adapterName,
  storageName: view.storageName,
  entryCount: (await view.getAllKeys()).length,
  capabilities: view.capabilities,
  supportsSubscriptions: view.supportsSubscriptions,
});

const hasDuplicateTargets = (views: readonly Pick<StorageView, 'target'>[]) => {
  const targets = new Set<string>();

  return views.some(({ target }) => {
    const id = `${target.adapterId}:${target.storageId}`;

    if (targets.has(id)) {
      return true;
    }

    targets.add(id);
    return false;
  });
};

export const handleStorageDiscoveryRequest = async (
  views: readonly StorageView[],
  payload: unknown,
): Promise<DiscoveryResult> => {
  const requestId = getRequestId(payload);

  if (!validateRequest(payload)) {
    return {
      type: 'storage-request-error',
      requestId,
      code: 'INVALID_REQUEST',
      message: 'Storage discovery requires a non-empty request ID.',
    };
  }

  try {
    if (hasDuplicateTargets(views)) {
      return {
        type: 'storage-request-error',
        requestId,
        code: 'INVALID_REQUEST',
        message: 'Configured storages must have unique targets.',
      };
    }

    const storages = await Promise.all(views.map(toDescriptor));

    return { type: 'storage-descriptors', requestId, storages };
  } catch {
    return {
      type: 'storage-request-error',
      requestId,
      code: 'READ_FAILED',
      message: 'Failed to discover configured storages.',
    };
  }
};
