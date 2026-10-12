import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor, normalizePageLimit, paginateArray } from '../index.js';

type Row = { key: string; value: number };

const makeRows = (count: number): Row[] =>
  Array.from({ length: count }, (_, index) => ({ key: `row-${index}`, value: index }));

const keyOf = (row: Row) => row.key;

describe('paginateArray', () => {
  it('returns the first page without a cursor', () => {
    const result = paginateArray(makeRows(5), { keyOf, limit: 2 });

    expect(result.items.map(keyOf)).toEqual(['row-0', 'row-1']);
    expect(result.page).toMatchObject({ limit: 2, hasMore: true });
    expect(typeof result.page.nextCursor).toBe('string');
  });

  it('continues after the last row across three pages', () => {
    const rows = makeRows(5);
    const first = paginateArray(rows, { keyOf, limit: 2 });
    const second = paginateArray(rows, { keyOf, limit: 2, cursor: first.page.nextCursor });
    const third = paginateArray(rows, { keyOf, limit: 2, cursor: second.page.nextCursor });

    expect(second.items.map(keyOf)).toEqual(['row-2', 'row-3']);
    expect(third.items.map(keyOf)).toEqual(['row-4']);
    expect(third.page).toEqual({ limit: 2, hasMore: false });
  });

  it('resumes after the cursor row when rows before it were removed', () => {
    const rows = makeRows(6);
    const first = paginateArray(rows, { keyOf, limit: 3 });
    const afterDeletion = rows.filter((row) => row.key !== 'row-0');

    const second = paginateArray(afterDeletion, { keyOf, limit: 3, cursor: first.page.nextCursor });

    expect(second.items.map(keyOf)).toEqual(['row-3', 'row-4', 'row-5']);
  });

  it('answers reset when the cursor row is gone', () => {
    const rows = makeRows(4);
    const first = paginateArray(rows, { keyOf, limit: 2 });
    const withoutAnchor = rows.filter((row) => row.key !== 'row-1');

    expect(
      paginateArray(withoutAnchor, { keyOf, limit: 2, cursor: first.page.nextCursor }),
    ).toEqual({
      items: [],
      page: { limit: 2, hasMore: false, reset: true },
    });
  });

  it('answers reset when the generation moved on', () => {
    const rows = makeRows(4);
    const first = paginateArray(rows, { keyOf, limit: 2, generation: 1 });

    expect(
      paginateArray(rows, { keyOf, limit: 2, cursor: first.page.nextCursor, generation: 2 }),
    ).toEqual({ items: [], page: { limit: 2, hasMore: false, reset: true } });
    expect(
      paginateArray(rows, {
        keyOf,
        limit: 2,
        cursor: first.page.nextCursor,
        generation: 1,
      }).items.map(keyOf),
    ).toEqual(['row-2', 'row-3']);
  });

  it('throws when the cursor was issued for another scope', () => {
    const rows = makeRows(4);
    const first = paginateArray(rows, { keyOf, limit: 2, scope: 'level=error' });

    expect(() =>
      paginateArray(rows, { keyOf, limit: 2, cursor: first.page.nextCursor, scope: 'level=warn' }),
    ).toThrow('Cursor does not match this listing. Run the command again without cursor.');
  });

  it.each([
    ['not base64url', '***'],
    ['impossible length', 'abcde'],
    ['not JSON', encodeCursor('x').slice(0, -2)],
    ['not an object', encodeCursor([1, 2])],
    ['missing key', encodeCursor({ s: 'scope' })],
    ['wrong key type', encodeCursor({ k: true })],
    ['non-string argument', 42],
  ])('throws for a garbage cursor (%s)', (_, cursor) => {
    expect(() => paginateArray(makeRows(3), { keyOf, cursor })).toThrow(
      'Invalid "cursor". Run the command again without cursor to restart pagination.',
    );
  });

  it('rejects rows that share a key instead of looping on them', () => {
    const rows = ['a', 'b', 'b'].map((key, value) => ({ key, value }));
    expect(() => paginateArray(rows, { keyOf, limit: 1 })).toThrow(
      'paginateArray: keyOf must return a unique key per row (duplicate: b)',
    );
  });

  it('normalises limit to the shared default and cap', () => {
    const rows = makeRows(150);

    expect(paginateArray(rows, { keyOf }).items).toHaveLength(20);
    expect(paginateArray(rows, { keyOf, limit: 500 }).page.limit).toBe(100);
    expect(paginateArray(rows, { keyOf, limit: '5' }).items).toHaveLength(5);
    for (const limit of [0, -1, 1.5, 'ten', true]) {
      expect(() => paginateArray(rows, { keyOf, limit })).toThrow(
        '"limit" must be an integer between 1 and 100',
      );
    }
  });

  it('round-trips Unicode and numeric keys', () => {
    const unicode = [{ key: 'zażółć 🙂' }, { key: '日本語/キー' }, { key: 'tail' }];
    const unicodePage = paginateArray(unicode, { keyOf: (row) => row.key, limit: 1 });
    expect(
      paginateArray(unicode, {
        keyOf: (row) => row.key,
        limit: 1,
        cursor: unicodePage.page.nextCursor,
      }).items,
    ).toEqual([{ key: '日本語/キー' }]);

    const numeric = [{ seq: 10 }, { seq: 11 }, { seq: 12 }];
    const numericPage = paginateArray(numeric, { keyOf: (row) => row.seq, limit: 1 });
    expect(
      paginateArray(numeric, {
        keyOf: (row) => row.seq,
        limit: 1,
        cursor: numericPage.page.nextCursor,
      }).items,
    ).toEqual([{ seq: 11 }]);
  });
});

describe('cursor encoding', () => {
  it('produces base64url without padding and round-trips any Unicode', () => {
    const payload = { k: 'a/b+c?=😀\u0000ą', s: 'scope', g: 3 };
    const cursor = encodeCursor(payload);

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor)).toEqual(payload);
  });

  it('matches the standard base64url encoding of the UTF-8 JSON', () => {
    const payload = { k: 'ünï 🙂', n: [1, 2, 3] };

    expect(encodeCursor(payload)).toBe(
      Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url'),
    );
  });
});

describe('normalizePageLimit', () => {
  it('defaults absent values and caps large ones', () => {
    expect(normalizePageLimit(undefined)).toBe(20);
    expect(normalizePageLimit(null)).toBe(20);
    expect(normalizePageLimit(100)).toBe(100);
    expect(normalizePageLimit(101)).toBe(100);
  });
});
