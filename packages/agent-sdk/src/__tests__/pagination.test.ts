import { describe, expect, it, vi } from 'vitest';
import { callToolWithOptionalPagination } from '../pagination.js';

// Mirrors the real cursor encoding used by production paginated tools
// (e.g. packages/middleware/src/agent/local-domains.ts `paginateRows`):
// base64url JSON of { v: 1, scope, index }.
const encodeCursor = (scope: string, index: number): string => {
  return Buffer.from(
    JSON.stringify({ v: 1, scope, index }),
    'utf8',
  ).toString('base64url');
};

const decodeCursorIndex = (cursor: string): number => {
  const decoded = JSON.parse(
    Buffer.from(cursor, 'base64url').toString('utf8'),
  ) as { index: number };
  return decoded.index;
};

// A well-behaved paginated tool: honors whatever `limit` it's asked for on
// each call, and encodes `nextCursor` as the exact index to resume from.
// Used to prove the row-loss is caused by the SDK's own request/merge
// logic, not by a misbehaving producer.
const createWellBehavedPaginatedTool = (
  scope: string,
  totalRows: number,
) => {
  const rows = Array.from({ length: totalRows }, (_, i) => ({ id: i }));
  return vi.fn().mockImplementation((_name: string, args: unknown) => {
    const record = (args ?? {}) as { limit?: number; cursor?: string };
    const limit = record.limit ?? totalRows;
    const startIndex = record.cursor ? decodeCursorIndex(record.cursor) : 0;
    const endIndex = Math.min(startIndex + limit, rows.length);
    const items = rows.slice(startIndex, endIndex);
    const hasMore = endIndex < rows.length;
    return Promise.resolve({
      items,
      page: {
        limit,
        hasMore,
        nextCursor: hasMore ? encodeCursor(scope, endIndex) : undefined,
      },
    });
  });
};

describe('agent tool pagination helper', () => {
  it('returns raw result when auto-pagination is not requested', async () => {
    const client = {
      callTool: vi.fn().mockResolvedValue({ ok: true }),
    };

    const result = await callToolWithOptionalPagination(client, 'x', {}, {});

    expect(result).toEqual({ ok: true });
    expect(client.callTool).toHaveBeenCalledTimes(1);
  });

  it('follows cursors when pagesLimit is provided', async () => {
    const client = {
      callTool: vi
        .fn()
        .mockResolvedValueOnce({
          items: [{ id: 1 }],
          page: { limit: 1, hasMore: true, nextCursor: 'c1' },
        })
        .mockResolvedValueOnce({
          items: [{ id: 2 }],
          page: { limit: 1, hasMore: false },
        }),
    };

    const result = (await callToolWithOptionalPagination(
      client,
      'getMessages',
      { limit: 1 },
      { pagesLimit: 2 },
    )) as {
      items: Array<{ id: number }>;
      page: { hasMore: boolean; limit: number };
    };

    expect(result.items.map((item) => item.id)).toEqual([1, 2]);
    expect(result.page.hasMore).toBe(false);
    expect(result.page.limit).toBe(1);
    expect(client.callTool).toHaveBeenCalledTimes(2);
    expect(client.callTool).toHaveBeenNthCalledWith(2, 'getMessages', {
      limit: 1,
      cursor: 'c1',
    });
  });

  it('caps merged items when maxItems is provided', async () => {
    const client = {
      callTool: vi
        .fn()
        .mockResolvedValueOnce({
          items: [{ id: 1 }, { id: 2 }],
          page: { limit: 2, hasMore: true, nextCursor: 'c1' },
        })
        .mockResolvedValueOnce({
          items: [{ id: 3 }, { id: 4 }],
          page: { limit: 2, hasMore: false },
        }),
    };

    const result = (await callToolWithOptionalPagination(
      client,
      'listRequests',
      { limit: 2 },
      { pagesLimit: 2, maxItems: 3 },
    )) as {
      items: Array<{ id: number }>;
      page: { hasMore: boolean; nextCursor?: string; limit: number };
    };

    expect(result.items.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(result.page.hasMore).toBe(false);
    expect(result.page.nextCursor).toBeUndefined();
    expect(result.page.limit).toBe(2);
  });

  it('caps an oversized first page without fetching another page', async () => {
    // This producer ignores the requested `limit` (it always returns 3
    // items no matter what's asked) - the guaranteed-correct fallback path.
    // Since it over-returns relative to what was requested (2, driven by
    // maxItems), its `nextCursor: 'c1'` cannot be trusted to resume after
    // the item we discard, so it must be dropped and `truncated` reported.
    const client = {
      callTool: vi.fn().mockResolvedValue({
        items: [{ id: 1 }, { id: 2 }, { id: 3 }],
        page: { limit: 3, hasMore: true, nextCursor: 'c1' },
      }),
    };

    const result = (await callToolWithOptionalPagination(
      client,
      'listRequests',
      { limit: 3 },
      { pagesLimit: 2, maxItems: 2 },
    )) as {
      items: Array<{ id: number }>;
      page: {
        hasMore: boolean;
        nextCursor?: string;
        limit: number;
        truncated?: boolean;
      };
    };

    expect(result.items.map((item) => item.id)).toEqual([1, 2]);
    expect(result.page).toEqual({
      limit: 3,
      hasMore: true,
      nextCursor: undefined,
      truncated: true,
    });
    expect(client.callTool).toHaveBeenCalledTimes(1);
    // The SDK asked for exactly the remaining budget (min(callerLimit=3,
    // maxItems=2) = 2), not the caller's full page size of 3.
    expect(client.callTool).toHaveBeenCalledWith('listRequests', {
      limit: 2,
    });
  });

  it('stops merging if a subsequent page is not paged', async () => {
    const client = {
      callTool: vi
        .fn()
        .mockResolvedValueOnce({
          items: [{ id: 1 }],
          page: { limit: 1, hasMore: true, nextCursor: 'c1' },
        })
        .mockResolvedValueOnce({ ok: true }),
    };

    const result = (await callToolWithOptionalPagination(
      client,
      'listRequests',
      { limit: 1 },
      { pagesLimit: 2 },
    )) as {
      items: Array<{ id: number }>;
      page: { hasMore: boolean; nextCursor?: string; limit: number };
    };

    expect(result).toEqual({
      items: [{ id: 1 }],
      page: { limit: 1, hasMore: true, nextCursor: 'c1' },
    });
    expect(client.callTool).toHaveBeenCalledTimes(2);
  });

  it('restarts merged items when a subsequent page signals reset', async () => {
    const client = {
      callTool: vi
        .fn()
        .mockResolvedValueOnce({
          items: [{ id: 1 }],
          page: { limit: 1, hasMore: true, nextCursor: 'c1' },
        })
        .mockResolvedValueOnce({
          items: [{ id: 10 }],
          page: { limit: 1, hasMore: true, nextCursor: 'c2', reset: true },
        })
        .mockResolvedValueOnce({
          items: [{ id: 11 }],
          page: { limit: 1, hasMore: false },
        }),
    };

    const result = (await callToolWithOptionalPagination(
      client,
      'getMessages',
      { limit: 1 },
      { pagesLimit: 3 },
    )) as {
      items: Array<{ id: number }>;
      page: { hasMore: boolean; nextCursor?: string; limit: number; reset?: boolean };
    };

    expect(result.items.map((item) => item.id)).toEqual([10, 11]);
    expect(result.page).toEqual({
      limit: 1,
      hasMore: false,
    });
    expect(client.callTool).toHaveBeenCalledTimes(3);
  });

  it('reapplies maxItems after a reset page', async () => {
    const client = {
      callTool: vi
        .fn()
        .mockResolvedValueOnce({
          items: [{ id: 1 }],
          page: { limit: 1, hasMore: true, nextCursor: 'c1' },
        })
        .mockResolvedValueOnce({
          items: [{ id: 10 }, { id: 11 }, { id: 12 }],
          page: { limit: 3, hasMore: true, nextCursor: 'c2', reset: true },
        }),
    };

    const result = (await callToolWithOptionalPagination(
      client,
      'listRequests',
      { limit: 2 },
      { pagesLimit: 2, maxItems: 2 },
    )) as {
      items: Array<{ id: number }>;
      page: { hasMore: boolean; nextCursor?: string; limit: number; reset?: boolean };
    };

    expect(result.items.map((item) => item.id)).toEqual([10, 11]);
    expect(result.page).toEqual({
      limit: 1,
      hasMore: true,
      nextCursor: 'c2',
      reset: true,
    });
    expect(client.callTool).toHaveBeenCalledTimes(2);
  });

  it('BUG REPRO: drops rows on the initial page because the SDK requests a full page instead of maxItems', async () => {
    // A well-behaved 20-row producer. The caller asks for pages of 20 with
    // maxItems: 5. The un-fixed SDK forwards `limit: 20` unmodified on the
    // very first call, receives the ENTIRE 20-row dataset in one page
    // (hasMore: false - there is nothing left upstream), then trims the
    // response down to 5 items while keeping that page's `hasMore: false`.
    // Rows 5-19 are real, were served by the producer, and are now
    // unreachable: there's no cursor (hasMore is false) to go get them.
    const tool = createWellBehavedPaginatedTool('initial-repro', 20);
    const client = { callTool: tool };

    const result = (await callToolWithOptionalPagination(
      client,
      'listRequests',
      { limit: 20 },
      { pagesLimit: 1, maxItems: 5 },
    )) as {
      items: Array<{ id: number }>;
      page: { hasMore: boolean; nextCursor?: string; limit: number };
    };

    const receivedIds = result.items.map((item) => item.id);
    const reachableViaCursor: number[] = [];
    if (result.page.nextCursor) {
      for (
        let i = decodeCursorIndex(result.page.nextCursor);
        i < 20;
        i++
      ) {
        reachableViaCursor.push(i);
      }
    } else if (result.page.hasMore) {
      // hasMore is true but there's no cursor to act on - still unreachable.
    }
    const union = new Set([...receivedIds, ...reachableViaCursor]);

    const lostRows = Array.from({ length: 20 }, (_, i) => i).filter(
      (id) => !union.has(id),
    );
    // Rows 5-19 were served by the producer but are absent from both what
    // the caller received AND what's reachable via the reported cursor.
    expect(lostRows).toEqual([]);
    // The reported state must not falsely claim the dataset is exhausted.
    expect(result.page.hasMore).toBe(true);
  });

  it('BUG REPRO: drops rows mid-loop because subsequent requests reuse the caller limit instead of the remaining budget', async () => {
    // A well-behaved 20-row producer. Caller asks for pages of 5 with
    // maxItems: 7 over up to 2 pages. Page 1 delivers rows 0-4 (5 items,
    // remaining budget now 2). The un-fixed SDK's second call still asks
    // for `limit: 5` (the caller's original page size) instead of the
    // remaining budget of 2, so the producer legitimately returns rows
    // 5-9 with a valid nextCursor pointing at row 10. The SDK keeps only
    // 2 of those 5 rows (5, 6) to respect maxItems, discards rows 7-9, but
    // still reports the producer's nextCursor - which skips straight over
    // rows 7-9 to row 10. They are gone even though hasMore correctly
    // (but misleadingly, given the gap) says there's more.
    const tool = createWellBehavedPaginatedTool('mid-loop-repro', 20);
    const client = { callTool: tool };

    const result = (await callToolWithOptionalPagination(
      client,
      'listRequests',
      { limit: 5 },
      { pagesLimit: 2, maxItems: 7 },
    )) as {
      items: Array<{ id: number }>;
      page: { hasMore: boolean; nextCursor?: string; limit: number };
    };

    const receivedIds = result.items.map((item) => item.id);
    const reachableFromCursor = result.page.nextCursor
      ? decodeCursorIndex(result.page.nextCursor)
      : undefined;

    // Rows 7, 8, 9 were served by the producer, are not in the caller's
    // result, and are skipped over by the reported nextCursor (which jumps
    // straight to row 10): silent data loss with a misleading resume point.
    const droppedButSkippedOver = [7, 8, 9].filter(
      (id) =>
        !receivedIds.includes(id) &&
        reachableFromCursor !== undefined &&
        id < reachableFromCursor,
    );
    expect(droppedButSkippedOver).toEqual([]);
  });

  it('requires pagesLimit when maxItems is used', async () => {
    const client = {
      callTool: vi.fn(),
    };

    await expect(() =>
      callToolWithOptionalPagination(client, 'x', {}, { maxItems: 10 }),
    ).rejects.toThrow('autoPaginate.maxItems requires autoPaginate.pagesLimit');
  });

  it('rejects non-positive auto-pagination values', async () => {
    const client = {
      callTool: vi.fn(),
    };

    await expect(() =>
      callToolWithOptionalPagination(client, 'x', {}, { pagesLimit: 0 }),
    ).rejects.toThrow('autoPaginate.pagesLimit must be a positive integer');

    await expect(() =>
      callToolWithOptionalPagination(client, 'x', {}, { pagesLimit: 1, maxItems: 0 }),
    ).rejects.toThrow('autoPaginate.maxItems must be a positive integer');
  });
});
