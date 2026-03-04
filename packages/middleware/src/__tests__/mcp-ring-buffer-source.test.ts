import { describe, expect, it } from 'vitest';
import { createRingBufferSource } from '../mcp/console/ring-buffer-source.js';

describe('ring buffer paginated source', () => {
  const entries = [
    { seq: 1, text: 'a' },
    { seq: 2, text: 'b' },
    { seq: 3, text: 'c' },
    { seq: 4, text: 'd' },
  ];

  it('returns desc pages without duplicates', () => {
    const source = createRingBufferSource({
      items: entries,
      applyFilters: (items) => [...items],
    });

    const first = source.listFrom({
      order: 'desc',
      limit: 2,
      filters: {},
    });
    expect(first.items.map((entry) => entry.seq)).toEqual([4, 3]);
    expect(first.nextCheckpoint).toBe(2);

    const second = source.listFrom({
      order: 'desc',
      limit: 2,
      checkpoint: first.nextCheckpoint,
      filters: {},
    });
    expect(second.items.map((entry) => entry.seq)).toEqual([2, 1]);
    expect(second.hasMore).toBe(false);
  });

  it('marks stale cursor when checkpoint is older than retained range', () => {
    const source = createRingBufferSource({
      items: entries.slice(2),
      applyFilters: (items) => [...items],
    });

    const result = source.listFrom({
      order: 'desc',
      limit: 2,
      checkpoint: 1,
      filters: {},
    });

    expect(result.staleCursor).toBe(true);
  });
});
