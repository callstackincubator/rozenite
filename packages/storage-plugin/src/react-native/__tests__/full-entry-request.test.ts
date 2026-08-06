import { describe, expect, it, vi } from 'vitest';
import type { StorageAdapter, StorageEntry } from '../../shared/types';
import { handleFullEntryRequest } from '../full-entry-request';
import { createStorageViews } from '../storage-view';

const target = { adapterId: 'adapter', storageId: 'storage' };

const request = (overrides: Record<string, unknown> = {}) => ({
  type: 'get-entry' as const,
  requestId: 'request-1',
  target,
  key: 'key',
  ...overrides,
});

const createView = (
  values: Record<string, StorageEntry>,
  options?: {
    blacklist?: RegExp;
    get?: (
      key: string,
    ) => StorageEntry | undefined | Promise<StorageEntry | undefined>;
  },
) => {
  const get = vi.fn(options?.get ?? ((key: string) => values[key]));
  const getAllKeys = vi.fn(() => Object.keys(values));
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

describe('handleFullEntryRequest', () => {
  it('reads exactly the requested key and returns its complete typed value', async () => {
    const buffer = Array.from({ length: 4_096 }, (_, index) => index % 256);
    const { view, get, getAllKeys } = createView({
      key: { key: 'key', type: 'buffer', value: buffer },
      other: { key: 'other', type: 'string', value: 'not read' },
    });

    await expect(handleFullEntryRequest([view], request())).resolves.toEqual({
      type: 'entry',
      requestId: 'request-1',
      target,
      entry: { key: 'key', type: 'buffer', value: buffer },
    });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('key');
    expect(getAllKeys).not.toHaveBeenCalled();
  });

  it('returns structured errors for missing, blacklisted, invalid, and unknown targets', async () => {
    const missing = createView({});
    await expect(
      handleFullEntryRequest([missing.view], request()),
    ).resolves.toMatchObject({
      type: 'storage-request-error',
      requestId: 'request-1',
      code: 'ENTRY_NOT_FOUND',
    });

    const blacklisted = createView(
      { key: { key: 'key', type: 'string', value: 'secret' } },
      { blacklist: /^key$/ },
    );
    await expect(
      handleFullEntryRequest([blacklisted.view], request()),
    ).resolves.toMatchObject({
      code: 'ENTRY_NOT_FOUND',
    });
    expect(blacklisted.get).not.toHaveBeenCalled();

    await expect(
      handleFullEntryRequest([missing.view], request({ key: 42 })),
    ).resolves.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(
      handleFullEntryRequest(
        [missing.view],
        request({ target: { adapterId: 'missing', storageId: 'storage' } }),
      ),
    ).resolves.toMatchObject({ code: 'TARGET_NOT_FOUND' });
  });

  it('contains adapter read failures without exposing adapter errors', async () => {
    const { view } = createView(
      {},
      {
        get: () => {
          throw new Error('adapter internals');
        },
      },
    );

    await expect(handleFullEntryRequest([view], request())).resolves.toEqual({
      type: 'storage-request-error',
      requestId: 'request-1',
      code: 'READ_FAILED',
      message: 'Failed to read the requested storage entry.',
    });
  });

  it('keeps concurrent requests correlated', async () => {
    const resolvers = new Map<string, (entry: StorageEntry) => void>();
    const { view, get } = createView(
      {},
      {
        get: (key) =>
          new Promise<StorageEntry>((resolve) => {
            resolvers.set(key, resolve);
          }),
      },
    );
    const first = handleFullEntryRequest(
      [view],
      request({ requestId: 'first', key: 'first' }),
    );
    const second = handleFullEntryRequest(
      [view],
      request({ requestId: 'second', key: 'second' }),
    );

    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    resolvers.get('second')?.({ key: 'second', type: 'string', value: 'two' });
    resolvers.get('first')?.({ key: 'first', type: 'string', value: 'one' });

    await expect(first).resolves.toMatchObject({
      type: 'entry',
      requestId: 'first',
      entry: { key: 'first', value: 'one' },
    });
    await expect(second).resolves.toMatchObject({
      type: 'entry',
      requestId: 'second',
      entry: { key: 'second', value: 'two' },
    });
  });
});
