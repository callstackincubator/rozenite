import { describe, expect, it, vi } from 'vitest';
import { MAX_PAGE_LIMIT } from '@rozenite/agent-shared';
import { storageToolDefinitions } from '../../shared/agent-tools';
import type { StorageAdapter, StorageEntry } from '../../shared/types';

vi.mock('@rozenite/agent-bridge', () => ({
  useRozenitePluginAgentTool: vi.fn(),
}));

import { createStorageAgentHandlers } from '../useStorageAgentTools';
import { createStorageViews } from '../storage-view';

const createViews = (
  storages: Array<{
    adapterId: string;
    storageId: string;
    entries: Record<string, StorageEntry>;
  }>,
) => {
  const adapters = storages.map(({ adapterId, storageId, entries }): StorageAdapter => ({
    id: adapterId,
    name: `Adapter ${adapterId}`,
    storages: [
      {
        id: storageId,
        name: `Storage ${storageId}`,
        capabilities: { supportedTypes: ['string', 'buffer'] },
        storage: {
          kind: 'sync',
          getAllKeys: vi.fn(() => Object.keys(entries)),
          get: vi.fn((key: string) => entries[key]),
          set: vi.fn(),
          delete: vi.fn(),
          clear: vi.fn(),
        },
      },
    ],
  }));

  return { adapters, views: createStorageViews(adapters) };
};

const entries = (...keys: string[]): Record<string, StorageEntry> =>
  Object.fromEntries(keys.map((key) => [key, { key, type: 'string', value: `value:${key}` }]));

describe('storage Agent tool handlers', () => {
  it('lists storage descriptors without reading keys or values', async () => {
    const { adapters, views } = createViews([
      { adapterId: 'one', storageId: 'first', entries: entries('a') },
      { adapterId: 'two', storageId: 'second', entries: entries('b') },
    ]);

    await expect(createStorageAgentHandlers(views).listStorages()).resolves.toEqual({
      storages: [
        {
          adapterId: 'one',
          storageId: 'first',
          adapterName: 'Adapter one',
          storageName: 'Storage first',
          supportedTypes: ['string', 'buffer'],
        },
        {
          adapterId: 'two',
          storageId: 'second',
          adapterName: 'Adapter two',
          storageName: 'Storage second',
          supportedTypes: ['string', 'buffer'],
        },
      ],
    });
    for (const adapter of adapters) {
      const storage = adapter.storages[0].storage;
      expect(storage.getAllKeys).not.toHaveBeenCalled();
      expect(storage.get).not.toHaveBeenCalled();
    }
  });

  it('uses the shared cursor pagination contract and returns keys without values', async () => {
    const { adapters, views } = createViews([
      {
        adapterId: 'adapter',
        storageId: 'storage',
        entries: entries('first', 'second', 'third'),
      },
    ]);
    const handlers = createStorageAgentHandlers(views);

    expect(storageToolDefinitions.listEntries.pagination).toEqual({
      kind: 'cursor',
      fields: ['key'],
      defaultFields: ['key'],
    });

    const first = await handlers.listEntries({ limit: 2 });
    expect(first).toEqual({
      adapterId: 'adapter',
      storageId: 'storage',
      total: 3,
      items: [{ key: 'first' }, { key: 'second' }],
      page: {
        limit: 2,
        hasMore: true,
        nextCursor: expect.any(String),
      },
    });
    expect(first.items.every((item) => !('value' in item))).toBe(true);

    await expect(handlers.listEntries({ cursor: first.page.nextCursor })).resolves.toEqual({
      adapterId: 'adapter',
      storageId: 'storage',
      total: 3,
      items: [{ key: 'third' }],
      page: { limit: 20, hasMore: false },
    });
    expect(adapters[0].storages[0].storage.get).not.toHaveBeenCalled();
  });

  it('defaults invalid limits and offsets and caps oversized finite limits', async () => {
    const { views } = createViews([
      {
        adapterId: 'adapter',
        storageId: 'storage',
        entries: entries(
          ...Array.from({ length: MAX_PAGE_LIMIT + 1 }, (_, index) => String(index)),
        ),
      },
    ]);
    const handlers = createStorageAgentHandlers(views);

    for (const limit of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(handlers.listEntries({ limit })).resolves.toMatchObject({
        page: { limit: 20 },
      });
    }
    for (const offset of [
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      await expect(handlers.listEntries({ offset })).resolves.toMatchObject({
        items: expect.arrayContaining([{ key: '0' }]),
      });
    }
    const capped = await handlers.listEntries({ limit: MAX_PAGE_LIMIT + 1 });
    expect(capped.items).toHaveLength(MAX_PAGE_LIMIT);
    expect(capped.page).toMatchObject({
      limit: MAX_PAGE_LIMIT,
      hasMore: true,
    });
  });

  it('rejects malformed and target-mismatched cursors and ambiguous selections', async () => {
    const { views } = createViews([
      { adapterId: 'adapter', storageId: 'one', entries: entries('a', 'b') },
      { adapterId: 'adapter', storageId: 'two', entries: entries('c') },
      { adapterId: 'other', storageId: 'one', entries: entries('d') },
    ]);
    const handlers = createStorageAgentHandlers(views);
    const cursor = (
      await handlers.listEntries({
        adapterId: 'adapter',
        storageId: 'one',
        limit: 1,
      })
    ).page.nextCursor!;

    await expect(
      handlers.listEntries({
        adapterId: 'adapter',
        storageId: 'one',
        cursor: 'bad',
      }),
    ).rejects.toThrow('Invalid cursor');
    await expect(
      handlers.listEntries({
        adapterId: 'other',
        storageId: 'one',
        cursor,
      }),
    ).rejects.toThrow('Cursor does not match the requested storage');
    await expect(
      handlers.listEntries({
        adapterId: 'adapter',
        storageId: 'one',
        cursor,
        offset: 0,
      }),
    ).rejects.toThrow('either cursor or offset');
    await expect(handlers.listEntries({ adapterId: 'adapter' })).rejects.toThrow(
      'Multiple storages matched',
    );
    await expect(handlers.listEntries({ storageId: 'one' })).rejects.toThrow(
      'Multiple storages matched',
    );
  });

  it('returns a complete large value only when read-entry explicitly requests it', async () => {
    const value = 'x'.repeat(100_000);
    const { adapters, views } = createViews([
      {
        adapterId: 'adapter',
        storageId: 'storage',
        entries: {
          large: { key: 'large', type: 'string', value },
          other: { key: 'other', type: 'string', value: 'not read' },
        },
      },
    ]);
    const handlers = createStorageAgentHandlers(views);

    await expect(handlers.readEntry({ key: 'large' })).resolves.toEqual({
      adapterId: 'adapter',
      storageId: 'storage',
      entry: { key: 'large', type: 'string', value },
    });
    expect(adapters[0].storages[0].storage.get).toHaveBeenCalledTimes(1);
    expect(adapters[0].storages[0].storage.get).toHaveBeenCalledWith('large');
  });
});
