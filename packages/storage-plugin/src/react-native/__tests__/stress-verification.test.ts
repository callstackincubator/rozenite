import { describe, expect, it, vi } from 'vitest';
import type {
  StorageAdapter,
  StorageEntry,
  StorageEntryType,
} from '../../shared/types';
import {
  ENTRY_PREVIEW_READ_CONCURRENCY,
  MAX_ENTRY_PREVIEW_PAGE_SIZE,
  handleListEntryPreviewsRequest,
} from '../entry-preview-pagination';
import { handleStorageDiscoveryRequest } from '../storage-discovery';
import { createStorageViews } from '../storage-view';

const STORAGE_COUNT = 250;
const ENTRIES_PER_STORAGE = 1_000;
const MEGABYTE_VALUE = 'x'.repeat(1024 * 1024);
const selectedTarget = { adapterId: 'stress', storageId: 'storage-000' };

const keys = Array.from(
  { length: ENTRIES_PER_STORAGE },
  (_, index) => `entry-${String(index).padStart(4, '0')}`,
);

const previewRequest = (overrides: Record<string, unknown> = {}) => ({
  type: 'list-entry-previews' as const,
  requestId: 'stress-request',
  target: selectedTarget,
  limit: MAX_ENTRY_PREVIEW_PAGE_SIZE,
  ...overrides,
});

const createStressAdapter = () => {
  let activeReads = 0;
  let maxActiveReads = 0;
  const storageReads = Array.from({ length: STORAGE_COUNT }, (_, index) => {
    const getAllKeys = vi.fn(async () => keys);
    const get = vi.fn(async (key: string): Promise<StorageEntry> => {
      activeReads += 1;
      maxActiveReads = Math.max(maxActiveReads, activeReads);
      // This fixture is intentionally asynchronous. The assertion below uses
      // counts, rather than duration, so it stays deterministic under load.
      await new Promise((resolve) => setTimeout(resolve, 1));
      activeReads -= 1;
      return { key, type: 'string', value: MEGABYTE_VALUE };
    });

    return {
      getAllKeys,
      get,
      node: {
        id: `storage-${String(index).padStart(3, '0')}`,
        name: `Stress storage ${index}`,
        capabilities: { supportedTypes: ['string'] as StorageEntryType[] },
        storage: {
          kind: 'async' as const,
          getAllKeys,
          get,
          set: vi.fn(async () => undefined),
          delete: vi.fn(async () => undefined),
        },
      },
    };
  });

  const adapter: StorageAdapter = {
    id: 'stress',
    name: 'Stress adapter',
    storages: storageReads.map(({ node }) => node),
  };

  return {
    maxActiveReads: () => maxActiveReads,
    storageReads,
    views: createStorageViews([adapter]),
  };
};

describe('storage scalability stress fixture', () => {
  it('discovers many storages without starting value work', async () => {
    const fixture = createStressAdapter();

    expect(
      await handleStorageDiscoveryRequest(fixture.views, {
        type: 'discover-storages',
        requestId: 'discover-stress',
      }),
    ).toMatchObject({
      type: 'storage-descriptors',
      storages: expect.any(Array),
    });
    expect(fixture.views).toHaveLength(STORAGE_COUNT);
    for (const { get, getAllKeys } of fixture.storageReads) {
      expect(getAllKeys).toHaveBeenCalledTimes(1);
      expect(get).not.toHaveBeenCalled();
    }
  });

  it('reads only one bounded page from the selected storage when values are slow and large', async () => {
    const fixture = createStressAdapter();

    const result = await handleListEntryPreviewsRequest(
      fixture.views,
      previewRequest(),
    );

    expect(result).toMatchObject({
      type: 'entry-previews',
      items: Array.from({ length: MAX_ENTRY_PREVIEW_PAGE_SIZE }, () =>
        expect.objectContaining({
          preview: 'x'.repeat(256),
          valueSize: MEGABYTE_VALUE.length,
          isTruncated: true,
        }),
      ),
    });
    if (result.type === 'entry-previews') {
      expect(result.items.every((item) => !('value' in item))).toBe(true);
    }
    expect(fixture.storageReads[0]?.getAllKeys).toHaveBeenCalledTimes(1);
    expect(fixture.storageReads[0]?.get).toHaveBeenCalledTimes(
      MAX_ENTRY_PREVIEW_PAGE_SIZE,
    );
    expect(fixture.maxActiveReads()).toBeLessThanOrEqual(
      ENTRY_PREVIEW_READ_CONCURRENCY,
    );
    for (const { get, getAllKeys } of fixture.storageReads.slice(1)) {
      expect(getAllKeys).not.toHaveBeenCalled();
      expect(get).not.toHaveBeenCalled();
    }
  });

  it('searches keys first and reads only the resulting page', async () => {
    const fixture = createStressAdapter();

    const result = await handleListEntryPreviewsRequest(
      fixture.views,
      previewRequest({ search: '  0999  ' }),
    );

    expect(result).toMatchObject({
      type: 'entry-previews',
      items: [expect.objectContaining({ key: 'entry-0999' })],
    });
    expect(fixture.storageReads[0]?.get).toHaveBeenCalledExactlyOnceWith(
      'entry-0999',
    );
    for (const { get } of fixture.storageReads.slice(1)) {
      expect(get).not.toHaveBeenCalled();
    }
  });
});
