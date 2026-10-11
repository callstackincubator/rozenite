import { describe, expect, it } from 'vitest';
import { formatAgentCommand, paginateListing } from '../commands/agent/output-shaping.js';

describe('agent output shaping (CLI-only)', () => {
  const keyOf = (row: { name: string }) => row.name;

  it('supports cursor pagination across pages', () => {
    const rows = [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }, { name: 'e' }];

    const first = paginateListing(rows, { keyOf, scope: 'domain:network', limit: 2 });
    expect(first.items).toEqual([{ name: 'a' }, { name: 'b' }]);
    expect(first.page.hasMore).toBe(true);
    expect(first.page.nextCursor).toBeTruthy();

    const second = paginateListing(rows, {
      keyOf,
      scope: 'domain:network',
      limit: 2,
      cursor: first.page.nextCursor!,
    });
    expect(second.items).toEqual([{ name: 'c' }, { name: 'd' }]);
    expect(second.page.hasMore).toBe(true);

    const third = paginateListing(rows, {
      keyOf,
      scope: 'domain:network',
      limit: 2,
      cursor: second.page.nextCursor!,
    });
    expect(third.items).toEqual([{ name: 'e' }]);
    expect(third.page.hasMore).toBe(false);
    expect(third.page.nextCursor).toBeUndefined();
  });

  it('resumes after the last row even when an earlier row disappeared', () => {
    const first = paginateListing([{ name: 'a' }, { name: 'b' }, { name: 'c' }], {
      keyOf,
      scope: 'targets',
      limit: 2,
    });

    const next = paginateListing([{ name: 'b' }, { name: 'c' }], {
      keyOf,
      scope: 'targets',
      limit: 2,
      cursor: first.page.nextCursor!,
    });
    expect(next.items).toEqual([{ name: 'c' }]);
  });

  it('answers an empty reset page when the cursor row is gone', () => {
    const first = paginateListing([{ name: 'a' }, { name: 'b' }], {
      keyOf,
      scope: 'targets',
      limit: 1,
    });

    expect(
      paginateListing([{ name: 'b' }], {
        keyOf,
        scope: 'targets',
        limit: 1,
        cursor: first.page.nextCursor!,
      }),
    ).toEqual({ items: [], page: { limit: 1, hasMore: false, reset: true } });
  });

  it('rejects an invalid cursor and one from another listing', () => {
    const rows = [{ name: 'a' }, { name: 'b' }];
    expect(() =>
      paginateListing(rows, { keyOf, scope: 'domains', limit: 1, cursor: 'bad-cursor' }),
    ).toThrow(/Invalid "cursor"/);

    const first = paginateListing(rows, { keyOf, scope: 'domains', limit: 1 });
    expect(() =>
      paginateListing(rows, {
        keyOf,
        scope: 'targets',
        limit: 1,
        cursor: first.page.nextCursor!,
      }),
    ).toThrow(/does not match this listing/);
  });

  it('makes next commands safe to paste into a POSIX shell', () => {
    expect(formatAgentCommand(['domains', '--device', "device with ' quote"])).toBe(
      "npx rozenite agent domains --device 'device with '\"'\"' quote'",
    );
  });

  it('emits slash-containing domain ids unquoted and shell-safe', () => {
    expect(formatAgentCommand(['avasapp/ably', '--cursor', 'cursor'])).toBe(
      'npx rozenite agent avasapp/ably --cursor cursor',
    );
  });
});
