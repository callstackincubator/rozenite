import { describe, expect, it, vi } from 'vitest';
import type { StorageAdapter, StorageEntry } from '../../shared/types';
import {
  ENTRY_PREVIEW_READ_CONCURRENCY,
  MAX_ENTRY_PREVIEW_PAGE_SIZE,
  handleListEntryPreviewsRequest,
} from '../entry-preview-pagination';
import { createStorageViews } from '../storage-view';

const target = { adapterId: 'adapter', storageId: 'storage' };

const createView = (
  values: Record<string, StorageEntry>,
  options?: {
    blacklist?: RegExp;
    get?: (key: string) => StorageEntry | undefined | Promise<StorageEntry | undefined>;
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
        capabilities: { supportedTypes: ['string'] },
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

const entries = (...keys: string[]): Record<string, StorageEntry> =>
  Object.fromEntries(keys.map((key) => [key, { key, type: 'string', value: `value:${key}` }]));

const request = (overrides: Record<string, unknown> = {}) => ({
  type: 'list-entry-previews' as const,
  requestId: 'request-1',
  target,
  limit: 2,
  ...overrides,
});

describe('handleListEntryPreviewsRequest', () => {
  it('returns sorted first, next, and previous pages without reading outside each page', async () => {
    const { view, get } = createView(entries('delta', 'bravo', 'alpha', 'charlie', 'echo'));

    const first = await handleListEntryPreviewsRequest([view], request());
    expect(first).toMatchObject({
      type: 'entry-previews',
      items: [{ key: 'alpha' }, { key: 'bravo' }],
    });
    expect(get).toHaveBeenCalledTimes(2);

    const next = await handleListEntryPreviewsRequest(
      [view],
      request({
        cursor: first.type === 'entry-previews' ? first.nextCursor : undefined,
      }),
    );
    expect(next).toMatchObject({
      type: 'entry-previews',
      items: [{ key: 'charlie' }, { key: 'delta' }],
    });
    expect(get).toHaveBeenCalledTimes(4);

    const previous = await handleListEntryPreviewsRequest(
      [view],
      request({
        cursor: next.type === 'entry-previews' ? next.previousCursor : undefined,
      }),
    );
    expect(previous).toMatchObject({
      type: 'entry-previews',
      items: [{ key: 'alpha' }, { key: 'bravo' }],
    });
    expect(get).toHaveBeenCalledTimes(6);
  });

  it('filters normalized key search and sorts before pagination without inspecting non-page values', async () => {
    const { view, get } = createView(entries('Alpha', 'alphabet', 'beta', 'ALPINE'));

    const result = await handleListEntryPreviewsRequest(
      [view],
      request({ search: ' ALP ', keySortDirection: 'descending', limit: 1 }),
    );

    expect(result).toMatchObject({
      type: 'entry-previews',
      items: [{ key: 'alphabet' }],
    });
    expect(get).toHaveBeenCalledWith('alphabet');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('returns empty and final pages without cursors', async () => {
    const { view, get } = createView(entries('only'));

    await expect(
      handleListEntryPreviewsRequest([view], request({ search: 'missing' })),
    ).resolves.toEqual({
      type: 'entry-previews',
      requestId: 'request-1',
      target,
      items: [],
    });
    await expect(handleListEntryPreviewsRequest([view], request())).resolves.toEqual({
      type: 'entry-previews',
      requestId: 'request-1',
      target,
      items: [
        {
          key: 'only',
          type: 'string',
          preview: 'value:only',
          valueSize: 10,
          isTruncated: false,
        },
      ],
    });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed, mismatched, and stale cursors with a reset signal', async () => {
    const { view } = createView(entries('alpha', 'bravo', 'charlie'));

    await expect(
      handleListEntryPreviewsRequest([view], request({ cursor: 'not-a-cursor' })),
    ).resolves.toMatchObject({ code: 'INVALID_CURSOR', resetPagination: true });

    const first = await handleListEntryPreviewsRequest([view], request());
    const cursor = first.type === 'entry-previews' ? first.nextCursor! : '';
    await expect(
      handleListEntryPreviewsRequest([view], request({ search: 'alpha', cursor })),
    ).resolves.toMatchObject({ code: 'INVALID_CURSOR', resetPagination: true });

    const stale = await handleListEntryPreviewsRequest([view], request({ cursor }));
    expect(stale).toMatchObject({ type: 'entry-previews' });
    const noBoundary = createView(entries('alpha', 'charlie')).view;
    await expect(
      handleListEntryPreviewsRequest([noBoundary], request({ cursor })),
    ).resolves.toMatchObject({ code: 'INVALID_CURSOR', resetPagination: true });
  });

  it('applies blacklist rules before pagination and caps oversized page limits', async () => {
    const { view, get } = createView(
      entries(
        ...Array.from({ length: MAX_ENTRY_PREVIEW_PAGE_SIZE + 2 }, (_, index) => `key-${index}`),
        'secret',
      ),
      { blacklist: /^secret$/ },
    );

    const result = await handleListEntryPreviewsRequest(
      [view],
      request({ limit: MAX_ENTRY_PREVIEW_PAGE_SIZE + 50 }),
    );

    expect(result).toMatchObject({ type: 'entry-previews' });
    expect(get).toHaveBeenCalledTimes(MAX_ENTRY_PREVIEW_PAGE_SIZE);
    expect(get).not.toHaveBeenCalledWith('secret');
  });

  it('bounds concurrent page reads and converts values to previews before returning', async () => {
    let activeReads = 0;
    let maxActiveReads = 0;
    const { view } = createView(entries('a', 'b', 'c', 'd', 'e'), {
      get: async (key) => {
        activeReads += 1;
        maxActiveReads = Math.max(maxActiveReads, activeReads);
        await new Promise((resolve) => setTimeout(resolve, 1));
        activeReads -= 1;
        return { key, type: 'string', value: 'x'.repeat(300) };
      },
    });

    const result = await handleListEntryPreviewsRequest([view], request({ limit: 5 }));

    expect(maxActiveReads).toBeLessThanOrEqual(ENTRY_PREVIEW_READ_CONCURRENCY);
    expect(result).toMatchObject({
      type: 'entry-previews',
      items: expect.arrayContaining([
        expect.objectContaining({
          preview: 'x'.repeat(256),
          isTruncated: true,
        }),
      ]),
    });
    if (result.type === 'entry-previews') {
      expect(result.items.every((item) => !('value' in item))).toBe(true);
    }
  });

  it('contains page-read failures in a structured response', async () => {
    const { view } = createView(entries('a', 'b'), {
      get: (key) => {
        if (key === 'a') {
          throw new Error('adapter internals');
        }
        return { key, type: 'string', value: 'value' };
      },
    });

    await expect(handleListEntryPreviewsRequest([view], request())).resolves.toEqual({
      type: 'storage-request-error',
      requestId: 'request-1',
      code: 'READ_FAILED',
      message: 'Failed to read entry previews from the requested storage.',
    });
  });

  it('rejects non-finite and non-positive limits without reading storage', async () => {
    const { view, getAllKeys } = createView(entries('key'));

    for (const limit of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(
        handleListEntryPreviewsRequest([view], request({ limit })),
      ).resolves.toMatchObject({ code: 'INVALID_REQUEST' });
    }
    expect(getAllKeys).not.toHaveBeenCalled();
  });
});
