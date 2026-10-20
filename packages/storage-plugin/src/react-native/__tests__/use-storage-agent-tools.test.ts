import { describe, expect, it, vi } from 'vitest';
import { useRozenitePluginAgentTool } from '@rozenite/agent-bridge';
import { MAX_PAGE_LIMIT } from '@rozenite/agent-shared';
import { storageToolDefinitions } from '../../shared/agent-tools';
import type { StorageAdapter, StorageEntry } from '../../shared/types';

vi.mock('@rozenite/agent-bridge', () => ({
  useRozenitePluginAgentTool: vi.fn(),
}));

import { createStorageAgentHandlers, useStorageAgentTools } from '../useStorageAgentTools';
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
          readOnly: false,
        },
        {
          adapterId: 'two',
          storageId: 'second',
          adapterName: 'Adapter two',
          storageName: 'Storage second',
          supportedTypes: ['string', 'buffer'],
          readOnly: false,
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
      meta: ['total'],
    });
    expect(storageToolDefinitions.listStorages.rows).toMatchObject({ key: 'storages' });

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

  it('rejects invalid limits, ignores invalid deprecated offsets and caps oversized limits', async () => {
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
      await expect(handlers.listEntries({ limit })).rejects.toThrow('"limit" must be an integer');
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

  it('resumes after the last key, so a deletion behind the cursor skips nothing', async () => {
    const storageEntries = entries('a', 'b', 'c', 'd');
    const { views } = createViews([
      { adapterId: 'adapter', storageId: 'storage', entries: storageEntries },
    ]);
    const handlers = createStorageAgentHandlers(views);

    const first = await handlers.listEntries({ limit: 2 });
    expect(first.items).toEqual([{ key: 'a' }, { key: 'b' }]);

    delete storageEntries.a;
    const second = await handlers.listEntries({ limit: 2, cursor: first.page.nextCursor });
    expect(second.items).toEqual([{ key: 'c' }, { key: 'd' }]);

    const restart = await handlers.listEntries({ limit: 1 });
    delete storageEntries.b;
    await expect(
      handlers.listEntries({ limit: 1, cursor: restart.page.nextCursor }),
    ).resolves.toMatchObject({ items: [], page: { limit: 1, hasMore: false, reset: true } });
  });

  it('pages over sorted keys, so an insertion that reorders the store skips nothing', async () => {
    let keys = ['c', 'a', 'd', 'b'];
    const views = createStorageViews([
      {
        id: 'adapter',
        name: 'Adapter',
        storages: [
          {
            id: 'storage',
            name: 'Storage',
            capabilities: { supportedTypes: ['string'] },
            storage: {
              kind: 'sync',
              getAllKeys: vi.fn(() => keys),
              get: vi.fn(),
              set: vi.fn(),
              delete: vi.fn(),
              clear: vi.fn(),
            },
          },
        ],
      },
    ]);
    const handlers = createStorageAgentHandlers(views);

    const first = await handlers.listEntries({ limit: 2 });
    expect(first.items).toEqual([{ key: 'a' }, { key: 'b' }]);

    // A write that reorders the underlying hash map and inserts a key
    // between the two pages.
    keys = ['d', 'bb', 'b', 'a', 'c'];
    const second = await handlers.listEntries({ limit: 2, cursor: first.page.nextCursor });
    expect(second.items).toEqual([{ key: 'bb' }, { key: 'c' }]);
    const third = await handlers.listEntries({ limit: 2, cursor: second.page.nextCursor });
    expect(third.items).toEqual([{ key: 'd' }]);
    expect(third.page.hasMore).toBe(false);
  });

  it('still starts the first page at a deprecated offset', async () => {
    const { views } = createViews([
      { adapterId: 'adapter', storageId: 'storage', entries: entries('a', 'b', 'c', 'd') },
    ]);
    const handlers = createStorageAgentHandlers(views);

    const first = await handlers.listEntries({ offset: 1, limit: 2 });
    expect(first).toMatchObject({ total: 4, items: [{ key: 'b' }, { key: 'c' }] });
    await expect(
      handlers.listEntries({ limit: 2, cursor: first.page.nextCursor }),
    ).resolves.toMatchObject({ items: [{ key: 'd' }], page: { hasMore: false } });
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
    ).rejects.toThrow('Invalid "cursor"');
    await expect(
      handlers.listEntries({
        adapterId: 'other',
        storageId: 'one',
        cursor,
      }),
    ).rejects.toThrow('Cursor does not match this listing');
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

  it('treats listed entries that cannot be read as existing in write tools', async () => {
    const { views } = createViews([
      { adapterId: 'adapter', storageId: 'storage', entries: entries('readable') },
    ]);
    // The key is listed, but reading it returns nothing (e.g. a locked Keychain item).
    const getAllKeys = vi.spyOn(views[0], 'getAllKeys').mockResolvedValue(['readable', 'locked']);
    vi.mocked(useRozenitePluginAgentTool).mockClear();
    useStorageAgentTools(views);
    const handler = (name: string) => {
      const call = vi
        .mocked(useRozenitePluginAgentTool)
        .mock.calls.find(([options]) => options.tool.name === name);
      return call?.[0].handler as (input: Record<string, unknown>) => Promise<unknown>;
    };

    await expect(
      handler('create-entry')({ key: 'locked', type: 'string', value: 'x' }),
    ).rejects.toThrow('already exists');
    await expect(
      handler('edit-entry')({ key: 'locked', type: 'string', value: 'x' }),
    ).resolves.toMatchObject({ edited: true });
    await expect(handler('remove-entry')({ key: 'locked' })).resolves.toMatchObject({
      removed: true,
    });
    await expect(handler('remove-entry')({ key: 'missing' })).resolves.toMatchObject({
      removed: false,
    });
    getAllKeys.mockRestore();
  });
});
