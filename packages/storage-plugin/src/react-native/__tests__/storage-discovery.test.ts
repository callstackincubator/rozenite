import { describe, expect, it, vi } from 'vitest';
import type {
  StorageAdapter,
  StorageCapabilities,
  StorageTarget,
} from '../../shared/types';
import { handleStorageDiscoveryRequest } from '../storage-discovery';
import { createStorageViews, type StorageView } from '../storage-view';

const capabilities: StorageCapabilities = {
  supportedTypes: ['string', 'number', 'boolean', 'buffer'],
};

const createAdapter = (): StorageAdapter => {
  const unexpectedRead = (method: string) =>
    vi.fn(() => {
      throw new Error(`Unexpected ${method} during discovery`);
    });

  return {
    id: 'adapter',
    name: 'Adapter',
    storages: [
      {
        id: 'subscribed',
        name: 'Subscribed storage',
        capabilities,
        storage: {
          kind: 'sync',
          getAllKeys: vi.fn(() => ['theme', 'token']),
          get: unexpectedRead('get'),
          set: vi.fn(),
          delete: vi.fn(),
          clear: vi.fn(),
          subscribe: vi.fn(() => ({ remove: vi.fn() })),
        },
      },
      {
        id: 'manual',
        name: 'Manual storage',
        capabilities,
        storage: {
          kind: 'sync',
          getAllKeys: vi.fn(() => ['session']),
          get: unexpectedRead('get'),
          set: vi.fn(),
          delete: vi.fn(),
          clear: vi.fn(),
        },
      },
    ],
  };
};

const request = { type: 'discover-storages', requestId: 'request-1' };

describe('handleStorageDiscoveryRequest', () => {
  it('returns ordered descriptors with key counts without reading values', async () => {
    const adapter = createAdapter();
    const views = createStorageViews([adapter]);

    const result = await handleStorageDiscoveryRequest(views, request);

    expect(result).toEqual({
      type: 'storage-descriptors',
      requestId: 'request-1',
      storages: [
        {
          target: { adapterId: 'adapter', storageId: 'subscribed' },
          adapterName: 'Adapter',
          storageName: 'Subscribed storage',
          entryCount: 2,
          capabilities,
          supportsSubscriptions: true,
        },
        {
          target: { adapterId: 'adapter', storageId: 'manual' },
          adapterName: 'Adapter',
          storageName: 'Manual storage',
          entryCount: 1,
          capabilities,
          supportsSubscriptions: false,
        },
      ],
    });

    for (const storage of adapter.storages) {
      expect(storage.storage.getAllKeys).toHaveBeenCalledTimes(1);
      expect(storage.storage.get).not.toHaveBeenCalled();
    }
  });

  it('returns a correlated structured error for invalid requests', async () => {
    expect(
      await handleStorageDiscoveryRequest(
        createStorageViews([createAdapter()]),
        {
          type: 'discover-storages',
          requestId: ' ',
        },
      ),
    ).toEqual({
      type: 'storage-request-error',
      requestId: ' ',
      code: 'INVALID_REQUEST',
      message: 'Storage discovery requires a non-empty request ID.',
    });
  });

  it('rejects duplicate configured targets predictably', async () => {
    const target: StorageTarget = { adapterId: 'adapter', storageId: 'shared' };
    const view = (storageName: string): StorageView => ({
      id: `adapter:${storageName}`,
      target,
      adapterName: 'Adapter',
      storageName,
      capabilities,
      supportsSubscriptions: false,
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      purge: vi.fn(),
      getAllKeys: vi.fn(),
      getAllEntries: vi.fn(),
      watch: vi.fn(),
    });

    expect(
      await handleStorageDiscoveryRequest([view('One'), view('Two')], request),
    ).toEqual({
      type: 'storage-request-error',
      requestId: 'request-1',
      code: 'INVALID_REQUEST',
      message: 'Configured storages must have unique targets.',
    });
  });

  it('does not expose adapter exceptions over the bridge', async () => {
    const view = {
      target: { adapterId: 'adapter', storageId: 'broken' },
      get adapterName() {
        throw new Error('adapter internals');
      },
    } as unknown as StorageView;

    await expect(
      handleStorageDiscoveryRequest([view], request),
    ).resolves.toEqual({
      type: 'storage-request-error',
      requestId: 'request-1',
      code: 'READ_FAILED',
      message: 'Failed to discover configured storages.',
    });
  });
});
