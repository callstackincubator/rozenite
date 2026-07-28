import { describe, expect, it } from 'vitest';
import {
  formatAgentCommand,
  parseFields,
  parseLimit,
  paginateRows,
  projectRows,
  shapePaginatedRows,
  shapeToolResult,
} from '../commands/agent/output-shaping.js';

describe('agent output shaping', () => {
  it('uses default fields when none provided', () => {
    const fields = parseFields(
      undefined,
      ['name', 'shortName', 'description'] as const,
      ['name', 'shortName'] as const,
      false,
    );
    expect(fields).toEqual(['name', 'shortName']);
  });

  it('parses valid fields and preserves order', () => {
    const fields = parseFields(
      'description,name',
      ['name', 'shortName', 'description'] as const,
      ['name', 'shortName'] as const,
      false,
    );
    expect(fields).toEqual(['description', 'name']);
  });

  it('throws on invalid fields', () => {
    expect(() =>
      parseFields(
        'name,badField',
        ['name', 'shortName', 'description'] as const,
        ['name', 'shortName'] as const,
        false,
      ),
    ).toThrow(/Unknown fields/);
  });

  it('supports cursor pagination across pages', () => {
    const rows = [
      { name: 'a' },
      { name: 'b' },
      { name: 'c' },
      { name: 'd' },
      { name: 'e' },
    ];

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

  it('projects rows and excludes schema-like fields', () => {
    const projected = projectRows(
      [
        {
          name: 'x',
          shortName: 'x',
          description: 'desc',
          inputSchema: { type: 'object' },
        },
      ],
      ['name', 'shortName'],
    );

    expect(projected).toEqual([{ name: 'x', shortName: 'x' }]);
    expect(projected[0]).not.toHaveProperty('inputSchema');
  });

  it('uses selected fields to encode two or more rows as columns', () => {
    const output = shapePaginatedRows(
      {
        items: [{ id: 'a', kind: 'static' }, { id: 'b' }],
        page: { limit: 20, hasMore: false },
      },
      ['id', 'kind'],
      undefined,
    );

    expect(output).toEqual({
      cols: ['id', 'kind'],
      rows: [
        ['a', 'static'],
        ['b', null],
      ],
    });
  });

  it('keeps zero and one row listings expanded and omits terminal pagination', () => {
    expect(
      shapePaginatedRows(
        { items: [], page: { limit: 20, hasMore: false } },
        ['id'],
        undefined,
      ),
    ).toEqual({ items: [] });
    expect(
      shapePaginatedRows(
        {
          items: [{ id: 'a' }],
          page: { limit: 1, hasMore: true, nextCursor: 'cursor' },
        },
        ['id'],
        'rozenite agent domains --cursor cursor',
      ),
    ).toEqual({
      items: [{ id: 'a' }],
      next: 'rozenite agent domains --cursor cursor',
    });
  });

  it('makes next commands safe to paste into a POSIX shell', () => {
    expect(
      formatAgentCommand(['domains', '--session', "session with ' quote"]),
    ).toBe("rozenite agent domains --session 'session with '\"'\"' quote'");
  });

  it('does not hide a malformed continuation from a known tool result', () => {
    const result = {
      items: [{ id: 'a' }, { id: 'b' }],
      page: { limit: 2, hasMore: true },
    };

    expect(shapeToolResult(result, ['id'], undefined)).toBe(result);
  });

  it('clamps limit to max range', () => {
    expect(parseLimit('500')).toBe(100);
  });
});
