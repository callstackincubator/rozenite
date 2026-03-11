import { describe, expect, it, vi } from 'vitest';
import {
  callToolWithOptionalPagination,
  resolveAutoPaginationConfig,
} from '../commands/agent/tool-pagination.js';

describe('agent tool pagination helper', () => {
  it('returns raw result when auto-pagination is not requested', async () => {
    const client = {
      callTool: vi.fn().mockResolvedValue({ ok: true }),
    } as any;

    const result = await callToolWithOptionalPagination(client, 'x', {}, {});

    expect(result).toEqual({ ok: true });
    expect(client.callTool).toHaveBeenCalledTimes(1);
  });

  it('follows cursors when --pages is provided', async () => {
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
    } as any;

    const result = await callToolWithOptionalPagination(
      client,
      'getMessages',
      { limit: 1 },
      { pagesLimit: 2 },
    ) as {
      items: Array<{ id: number }>;
      page: { hasMore: boolean };
    };

    expect(result.items.map((item) => item.id)).toEqual([1, 2]);
    expect(result.page.hasMore).toBe(false);
    expect(client.callTool).toHaveBeenCalledTimes(2);
  });

  it('requires --pages when --max-items is used', () => {
    expect(() => {
      resolveAutoPaginationConfig({ maxItems: '10' });
    }).toThrow('--max-items requires --pages');
  });
});
