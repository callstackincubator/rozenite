import { describe, expect, it } from 'vitest';
import { formatAgentCommand, paginateRows } from '../commands/agent/output-shaping.js';

describe('agent output shaping (CLI-only)', () => {
  it('supports cursor pagination across pages', () => {
    const rows = [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }, { name: 'e' }];

    const first = paginateRows(rows, {
      kind: 'tools',
      scope: 'domain:network',
      limit: 2,
    });
    expect(first.items).toEqual([{ name: 'a' }, { name: 'b' }]);
    expect(first.page.hasMore).toBe(true);
    expect(first.page.nextCursor).toBeTruthy();

    const second = paginateRows(rows, {
      kind: 'tools',
      scope: 'domain:network',
      limit: 2,
      cursor: first.page.nextCursor!,
    });
    expect(second.items).toEqual([{ name: 'c' }, { name: 'd' }]);
    expect(second.page.hasMore).toBe(true);
    expect(second.page.nextCursor).toBeTruthy();

    const third = paginateRows(rows, {
      kind: 'tools',
      scope: 'domain:network',
      limit: 2,
      cursor: second.page.nextCursor!,
    });
    expect(third.items).toEqual([{ name: 'e' }]);
    expect(third.page.hasMore).toBe(false);
    expect(third.page.nextCursor).toBeUndefined();
  });

  it('rejects invalid cursor', () => {
    const rows = [{ name: 'a' }];
    expect(() =>
      paginateRows(rows, {
        kind: 'tools',
        scope: 'domain:network',
        limit: 1,
        cursor: 'bad-cursor',
      }),
    ).toThrow(/Invalid --cursor/);
  });

  it('makes next commands safe to paste into a POSIX shell', () => {
    expect(formatAgentCommand(['domains', '--session', "session with ' quote"])).toBe(
      "npx rozenite agent domains --session 'session with '\"'\"' quote'",
    );
  });

  it('emits slash-containing domain ids unquoted and shell-safe', () => {
    expect(formatAgentCommand(['avasapp/ably', 'tools', '--cursor', 'cursor'])).toBe(
      'npx rozenite agent avasapp/ably tools --cursor cursor',
    );
  });
});
