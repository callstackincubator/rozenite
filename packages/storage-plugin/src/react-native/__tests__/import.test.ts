import { describe, expect, it, vi } from 'vitest';
import {
  handleImportEntries,
  handleImportPreviewRequest,
  type ImportEmittedEvent,
} from '../import';
import type { StorageView } from '../storage-view';
import { getStorageViewId } from '../../shared/types';
import type { StorageEntry, StorageTarget } from '../../shared/types';
import type { StorageImportEntriesEvent } from '../../shared/messaging';

const target: StorageTarget = { adapterId: 'mmkv', storageId: 'user' };

const buildView = (overrides?: Partial<StorageView>): StorageView => {
  const unexpected = (method: string) =>
    vi.fn(() => {
      throw new Error(`Unexpected call to ${method}`);
    });

  return {
    id: getStorageViewId(target),
    target,
    adapterName: 'MMKV',
    storageName: 'user',
    capabilities: {
      supportedTypes: ['string', 'number', 'boolean', 'buffer'],
    },
    get: unexpected('get'),
    set: vi.fn(async () => {}),
    delete: unexpected('delete'),
    getAllKeys: unexpected('getAllKeys'),
    getAllEntries: unexpected('getAllEntries'),
    watch: unexpected('watch'),
    ...overrides,
    supportsSubscriptions: overrides?.supportsSubscriptions ?? false,
  };
};

const buildEntries = (count: number): StorageEntry[] =>
  Array.from({ length: count }, (_, index) => ({
    key: `k${index}`,
    type: 'string' as const,
    value: `v${index}`,
  }));

describe('handleImportEntries', () => {
  it('emits value-free progress followed by one success import-result', async () => {
    const view = buildView();
    const entries = buildEntries(5);
    const event: StorageImportEntriesEvent = {
      type: 'import-entries',
      requestId: 'request-1',
      target,
      entries,
    };
    const emitted: ImportEmittedEvent[] = [];

    await handleImportEntries([view], event, (out) => emitted.push(out));

    expect(view.set).toHaveBeenCalledTimes(5);

    expect(emitted).toHaveLength(6);
    expect(emitted.slice(0, 5)).toEqual(
      entries.map((_, index) => ({
        type: 'import-progress',
        requestId: 'request-1',
        target,
        written: index + 1,
        total: 5,
      })),
    );
    expect(emitted[5]).toEqual({
      type: 'import-result',
      requestId: 'request-1',
      target,
      ok: true,
      written: 5,
      total: 5,
    });
  });

  it('stops at the first write that throws and reports the failed key', async () => {
    const failingKey = 'k2';
    const view = buildView({
      set: vi.fn(async (entry: StorageEntry) => {
        if (entry.key === failingKey) {
          throw new Error('boom');
        }
      }),
    });
    const entries = buildEntries(5);
    const event: StorageImportEntriesEvent = {
      type: 'import-entries',
      requestId: 'request-1',
      target,
      entries,
    };
    const emitted: ImportEmittedEvent[] = [];

    await handleImportEntries([view], event, (out) => emitted.push(out));

    // 2 value-free progress events (k0, k1), then the failure result.
    expect(view.set).toHaveBeenCalledTimes(3);
    expect(emitted).toHaveLength(3);
    expect(emitted[0]).toMatchObject({
      type: 'import-progress',
      requestId: 'request-1',
      written: 1,
    });
    expect(emitted[1]).toMatchObject({
      type: 'import-progress',
      requestId: 'request-1',
      written: 2,
    });
    expect(emitted[2]).toEqual({
      type: 'import-result',
      requestId: 'request-1',
      target,
      ok: false,
      written: 2,
      total: 5,
      failedKey: failingKey,
      error: 'boom',
    });
  });

  it('coerces non-Error throws to a string error message', async () => {
    const view = buildView({
      set: vi.fn(async () => {
        throw 'plain string failure';
      }),
    });
    const event: StorageImportEntriesEvent = {
      type: 'import-entries',
      requestId: 'request-1',
      target,
      entries: buildEntries(1),
    };
    const emitted: ImportEmittedEvent[] = [];

    await handleImportEntries([view], event, (out) => emitted.push(out));

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: 'import-result',
      requestId: 'request-1',
      ok: false,
      error: 'plain string failure',
    });
  });

  it('emits an unknown-target import-result without calling set', async () => {
    const view = buildView();
    const unknownTarget: StorageTarget = {
      adapterId: 'async-storage',
      storageId: 'default',
    };
    const entries = buildEntries(3);
    const event: StorageImportEntriesEvent = {
      type: 'import-entries',
      requestId: 'request-1',
      target: unknownTarget,
      entries,
    };
    const emitted: ImportEmittedEvent[] = [];

    await handleImportEntries([view], event, (out) => emitted.push(out));

    expect(view.set).not.toHaveBeenCalled();
    expect(emitted).toEqual([
      {
        type: 'import-result',
        requestId: 'request-1',
        target: unknownTarget,
        ok: false,
        written: 0,
        total: 3,
        error: 'Target storage not found',
      },
    ]);
  });

  it('handles empty entries as a successful no-op', async () => {
    const view = buildView();
    const event: StorageImportEntriesEvent = {
      type: 'import-entries',
      requestId: 'request-1',
      target,
      entries: [],
    };
    const emitted: ImportEmittedEvent[] = [];

    await handleImportEntries([view], event, (out) => emitted.push(out));

    expect(view.set).not.toHaveBeenCalled();
    expect(emitted).toEqual([
      {
        type: 'import-result',
        requestId: 'request-1',
        target,
        ok: true,
        written: 0,
        total: 0,
      },
    ]);
  });

  it('previews current device keys and blacklist decisions without reading values', async () => {
    const view = buildView({
      getAllKeys: vi.fn(async () => ['existing', 'unseen']),
      blacklist: /^private$/,
    });

    const result = await handleImportPreviewRequest([view], {
      type: 'preview-import',
      requestId: 'preview-1',
      target,
      snapshot: {
        version: 1,
        plugin: '@rozenite/storage-plugin',
        createdAt: '2026-01-01T00:00:00.000Z',
        storage: {
          adapterId: target.adapterId,
          storageId: target.storageId,
          adapterName: 'MMKV',
          storageName: 'user',
          capabilities: view.capabilities,
        },
        entries: [
          { key: 'existing', type: 'string', value: 'new' },
          { key: 'fresh', type: 'string', value: 'value' },
          { key: 'private', type: 'string', value: 'hidden' },
        ],
      },
    });

    expect(result).toMatchObject({
      type: 'import-preview',
      requestId: 'preview-1',
      target,
      preview: {
        overwriteKeys: ['existing'],
        newKeys: ['fresh'],
        skippedKeys: [{ key: 'private', reason: 'blacklist' }],
        acceptedEntryIndexes: [0, 1],
      },
    });
    expect(view.get).not.toHaveBeenCalled();
  });

  it('rechecks blacklist and supported types when applying a stale preview', async () => {
    const view = buildView({
      capabilities: { supportedTypes: ['string'] },
      blacklist: /^blocked$/,
    });
    const emitted: ImportEmittedEvent[] = [];

    await handleImportEntries(
      [view],
      {
        type: 'import-entries',
        requestId: 'request-1',
        target,
        entries: [
          { key: 'blocked', type: 'string', value: 'skip' },
          { key: 'binary', type: 'buffer', value: [1] },
          { key: 'kept', type: 'string', value: 'write' },
        ],
      },
      (out) => emitted.push(out),
    );

    expect(view.set).toHaveBeenCalledTimes(1);
    expect(emitted).toEqual([
      {
        type: 'import-progress',
        requestId: 'request-1',
        target,
        written: 1,
        total: 1,
      },
      {
        type: 'import-result',
        requestId: 'request-1',
        target,
        ok: true,
        written: 1,
        total: 1,
      },
    ]);
  });

  it('returns predictable errors for malformed and unknown preview targets', async () => {
    const view = buildView();

    await expect(handleImportPreviewRequest([view], {})).resolves.toMatchObject(
      {
        type: 'storage-request-error',
        requestId: '',
        code: 'INVALID_REQUEST',
      },
    );
    await expect(
      handleImportPreviewRequest([view], {
        type: 'preview-import',
        requestId: 'preview-1',
        target: { adapterId: 'missing', storageId: 'missing' },
        snapshot: {
          version: 1,
          plugin: '@rozenite/storage-plugin',
          createdAt: '2026-01-01T00:00:00.000Z',
          storage: {
            adapterId: target.adapterId,
            storageId: target.storageId,
            adapterName: 'MMKV',
            storageName: 'user',
            capabilities: view.capabilities,
          },
          entries: [],
        },
      }),
    ).resolves.toMatchObject({
      type: 'storage-request-error',
      requestId: 'preview-1',
      code: 'TARGET_NOT_FOUND',
    });
  });
});
