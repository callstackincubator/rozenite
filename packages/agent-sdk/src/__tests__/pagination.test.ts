import { describe, expect, it, vi } from 'vitest';
import { callToolWithOptionalPagination } from '../pagination.js';

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
      page: { hasMore: boolean; nextCursor?: string; limit: number };
    };

    expect(result.items.map((item) => item.id)).toEqual([1, 2]);
    expect(result.page).toEqual({
      limit: 3,
      hasMore: true,
      nextCursor: 'c1',
    });
    expect(client.callTool).toHaveBeenCalledTimes(1);
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
