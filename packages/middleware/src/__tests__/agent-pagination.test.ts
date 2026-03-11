import { describe, expect, it } from 'vitest';
import { encodeCursor, hashFilters } from '../agent/pagination/cursor.js';
import { normalizePageLimit } from '../agent/pagination/limits.js';
import { paginateSource } from '../agent/pagination/paginate.js';
import type { PaginatedSource } from '../agent/pagination/types.js';

describe('agent pagination', () => {
  it('normalizes page limits with defaults and max clamp', () => {
    expect(normalizePageLimit(undefined)).toBe(50);
    expect(normalizePageLimit(10)).toBe(10);
    expect(normalizePageLimit(1000)).toBe(200);
  });

  it('paginates with an encoded cursor and preserves context', () => {
    const source: PaginatedSource<number, { seq: number }, { kind: string }> = {
      listFrom: ({ checkpoint, limit }) => {
        const start = checkpoint ?? 5;
        const items = Array.from({ length: Math.min(limit, start) }, (_, index) => ({
          seq: start - index,
        }));
        const last = items[items.length - 1]?.seq;

        return {
          items,
          hasMore: (last ?? 0) > 1,
          ...(last && last > 1 ? { nextCheckpoint: last - 1 } : {}),
        };
      },
      getBounds: () => ({ earliest: 1, latest: 5 }),
    };

    const first = paginateSource(source, {
      tool: 'getMessages',
      deviceId: 'device-1',
      request: {
        limit: 2,
        filters: { kind: 'all' },
      },
    });

    expect(first.items.map((item) => item.seq)).toEqual([5, 4]);
    expect(first.page.hasMore).toBe(true);

    const second = paginateSource(source, {
      tool: 'getMessages',
      deviceId: 'device-1',
      request: {
        limit: 2,
        cursor: first.page.nextCursor,
        filters: { kind: 'all' },
      },
    });

    expect(second.items.map((item) => item.seq)).toEqual([3, 2]);
  });

  it('resets when source marks cursor as stale', () => {
    const source: PaginatedSource<number, { seq: number }, Record<string, never>> = {
      listFrom: ({ checkpoint }) => {
        if (checkpoint !== undefined) {
          return {
            items: [],
            hasMore: false,
            staleCursor: true,
          };
        }

        return {
          items: [{ seq: 3 }, { seq: 2 }],
          hasMore: false,
        };
      },
      getBounds: () => ({ earliest: 2, latest: 3 }),
    };

    const staleCursor = encodeCursor({
      v: 1,
      tool: 'getMessages',
      deviceId: 'device-1',
      position: 1,
      filtersHash: hashFilters({}),
      order: 'desc',
    });

    const result = paginateSource(source, {
      tool: 'getMessages',
      deviceId: 'device-1',
      request: {
        cursor: staleCursor,
        filters: {},
      },
    });

    expect(result.page.reset).toBe(true);
    expect(result.items.length).toBe(2);
  });
});
