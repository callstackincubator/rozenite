import { describe, expect, it, vi } from 'vitest';
import { handleImportEntries, type ImportEmittedEvent } from '../import';
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
  };
};

const buildEntries = (count: number): StorageEntry[] =>
  Array.from({ length: count }, (_, index) => ({
    key: `k${index}`,
    type: 'string' as const,
    value: `v${index}`,
  }));

describe('handleImportEntries', () => {
  it('emits a set-entry echo per write followed by a success import-result', async () => {
    const view = buildView();
    const entries = buildEntries(5);
    const event: StorageImportEntriesEvent = {
      type: 'import-entries',
      target,
      entries,
    };
    const emitted: ImportEmittedEvent[] = [];

    await handleImportEntries([view], event, (out) => emitted.push(out));

    expect(view.set).toHaveBeenCalledTimes(5);

    expect(emitted).toHaveLength(6);
    expect(emitted.slice(0, 5)).toEqual(
      entries.map((entry) => ({
        type: 'set-entry',
        target,
        entry,
      })),
    );
    expect(emitted[5]).toEqual({
      type: 'import-result',
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
      target,
      entries,
    };
    const emitted: ImportEmittedEvent[] = [];

    await handleImportEntries([view], event, (out) => emitted.push(out));

    // 2 set-entry echoes (k0, k1), then the failure result. No echoes for k2+.
    expect(view.set).toHaveBeenCalledTimes(3);
    expect(emitted).toHaveLength(3);
    expect(emitted[0]).toMatchObject({ type: 'set-entry', entry: entries[0] });
    expect(emitted[1]).toMatchObject({ type: 'set-entry', entry: entries[1] });
    expect(emitted[2]).toEqual({
      type: 'import-result',
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
      target,
      entries: buildEntries(1),
    };
    const emitted: ImportEmittedEvent[] = [];

    await handleImportEntries([view], event, (out) => emitted.push(out));

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: 'import-result',
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
      target: unknownTarget,
      entries,
    };
    const emitted: ImportEmittedEvent[] = [];

    await handleImportEntries([view], event, (out) => emitted.push(out));

    expect(view.set).not.toHaveBeenCalled();
    expect(emitted).toEqual([
      {
        type: 'import-result',
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
      target,
      entries: [],
    };
    const emitted: ImportEmittedEvent[] = [];

    await handleImportEntries([view], event, (out) => emitted.push(out));

    expect(view.set).not.toHaveBeenCalled();
    expect(emitted).toEqual([
      {
        type: 'import-result',
        target,
        ok: true,
        written: 0,
        total: 0,
      },
    ]);
  });
});
