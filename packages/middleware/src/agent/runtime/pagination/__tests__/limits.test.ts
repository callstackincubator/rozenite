import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '@rozenite/agent-shared';
import { describe, expect, it } from 'vitest';
import { normalizePageLimit } from '../limits.js';
import { paginateSource } from '../paginate.js';
import type { PaginatedSource } from '../types.js';

describe('normalizePageLimit', () => {
  it('uses the shared default of 20 and cap of 100', () => {
    expect(DEFAULT_PAGE_LIMIT).toBe(20);
    expect(MAX_PAGE_LIMIT).toBe(100);
    expect(normalizePageLimit(undefined)).toBe(20);
  });

  it('caps requests above the maximum', () => {
    expect(normalizePageLimit(101)).toBe(100);
    expect(normalizePageLimit(5000)).toBe(100);
    expect(normalizePageLimit(100)).toBe(100);
    expect(normalizePageLimit(7)).toBe(7);
  });

  it('rejects invalid limits with the shared maximum in the message', () => {
    for (const bad of [0, -1, 1.5, 'abc', null, Number.NaN]) {
      expect(() => normalizePageLimit(bad)).toThrow('"limit" must be an integer between 1 and 100');
    }
  });
});

describe('paginateSource limits', () => {
  const items = Array.from({ length: 250 }, (_, index) => index);
  const source: PaginatedSource<number, number, null> = {
    listFrom: ({ limit }) => ({ items: items.slice(0, limit), hasMore: items.length > limit }),
  };

  it('returns 20 items when no limit is given', () => {
    const page = paginateSource(source, { request: { filters: null } });
    expect(page.items).toHaveLength(20);
  });

  it('caps oversized limits at 100 items', () => {
    const page = paginateSource(source, { request: { limit: 500, filters: null } });
    expect(page.items).toHaveLength(100);
  });
});
