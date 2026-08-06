import { describe, expect, it, vi } from 'vitest';
import type { StorageAdapter, StorageEntry } from '../../shared/types';
import { handleExportSnapshotRequest } from '../export-snapshot';
import { createStorageViews } from '../storage-view';

const target = { adapterId: 'adapter', storageId: 'storage' };

const request = (overrides: Record<string, unknown> = {}) => ({
  type: 'export-snapshot' as const,
  requestId: 'request-1',
  target,
  ...overrides,
});

const createView = (
  values: Record<string, StorageEntry>,
  options?: { blacklist?: RegExp; getAllKeys?: () => string[] },
) => {
  const get = vi.fn((key: string) => values[key]);
  const getAllKeys = vi.fn(options?.getAllKeys ?? (() => Object.keys(values)));
  const adapter: StorageAdapter = {
    id: target.adapterId,
    name: 'Adapter',
    storages: [
      {
        id: target.storageId,
        name: 'Storage',
        capabilities: { supportedTypes: ['string', 'buffer'] },
        blacklist: options?.blacklist,
        storage: {
          kind: 'sync',
          getAllKeys,
          get: get as (key: string) => StorageEntry | undefined,
          set: vi.fn(),
          delete: vi.fn(),
          clear: vi.fn(),
        },
      },
    ],
  };

  return { view: createStorageViews([adapter])[0], get, getAllKeys };
};

describe('handleExportSnapshotRequest', () => {
  it('builds a schema-compatible snapshot from current device entries only when requested', async () => {
    const { view, get, getAllKeys } = createView(
      {
        retained: { key: 'retained', type: 'string', value: 'old UI page' },
        unseen: {
          key: 'unseen',
          type: 'string',
          value: 'current device value',
        },
        secret: { key: 'secret', type: 'string', value: 'excluded' },
      },
      { blacklist: /^secret$/ },
    );

    expect(getAllKeys).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();

    const result = await handleExportSnapshotRequest([view], request());

    expect(result).toMatchObject({
      type: 'export-snapshot-result',
      requestId: 'request-1',
      target,
      snapshot: {
        version: 1,
        plugin: '@rozenite/storage-plugin',
        storage: {
          adapterId: 'adapter',
          storageId: 'storage',
          adapterName: 'Adapter',
          storageName: 'Storage',
        },
        entries: [
          { key: 'retained', type: 'string', value: 'old UI page' },
          { key: 'unseen', type: 'string', value: 'current device value' },
        ],
      },
    });
    expect(getAllKeys).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).not.toHaveBeenCalledWith('secret');
  });

  it('exports an empty storage as a valid empty snapshot', async () => {
    const { view } = createView({});

    await expect(handleExportSnapshotRequest([view], request())).resolves.toMatchObject({
      type: 'export-snapshot-result',
      snapshot: { entries: [] },
    });
  });

  it('returns predictable invalid and missing-target errors', async () => {
    const { view } = createView({});

    await expect(
      handleExportSnapshotRequest(
        [view],
        request({ target: { adapterId: '', storageId: 'storage' } }),
      ),
    ).resolves.toMatchObject({
      code: 'INVALID_REQUEST',
      requestId: 'request-1',
    });
    await expect(
      handleExportSnapshotRequest(
        [view],
        request({ target: { adapterId: 'missing', storageId: 'storage' } }),
      ),
    ).resolves.toMatchObject({
      code: 'TARGET_NOT_FOUND',
      requestId: 'request-1',
    });
  });

  it('contains device read failures without exposing adapter errors', async () => {
    const { view } = createView(
      {},
      {
        getAllKeys: () => {
          throw new Error('adapter internals');
        },
      },
    );

    await expect(handleExportSnapshotRequest([view], request())).resolves.toEqual({
      type: 'storage-request-error',
      requestId: 'request-1',
      code: 'READ_FAILED',
      message: 'Failed to export the requested storage.',
    });
  });
});
