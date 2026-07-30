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

  it('defaults to a narrower projection than the full field set for a migrated tool', () => {
    // Mirrors console getMessages: defaultFields drops the heavy
    // argsPreview/context columns from the full declared field set.
    const allFields = [
      'seq',
      'timestamp',
      'level',
      'source',
      'text',
      'argsPreview',
      'context',
    ] as const;
    const defaultFields = [
      'seq',
      'timestamp',
      'level',
      'source',
      'text',
    ] as const;

    const fields = parseFields(undefined, allFields, defaultFields, false);

    expect(fields).toEqual([...defaultFields]);
    expect(fields.length).toBeLessThan(allFields.length);
    expect(fields).not.toContain('argsPreview');
    expect(fields).not.toContain('context');
  });

  it('--verbose widens a migrated tool default projection back to the full field set', () => {
    const allFields = [
      'seq',
      'timestamp',
      'level',
      'source',
      'text',
      'argsPreview',
      'context',
    ] as const;
    const defaultFields = [
      'seq',
      'timestamp',
      'level',
      'source',
      'text',
    ] as const;

    const fields = parseFields(undefined, allFields, defaultFields, true);

    expect(fields).toEqual([...allFields]);
    expect(fields).toContain('argsPreview');
    expect(fields).toContain('context');
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

  it('projects every row into the selected schema in deterministic order', () => {
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

    expect(
      projectRows([{ name: 'missing short name' }], ['shortName', 'name']),
    ).toEqual([{ shortName: null, name: 'missing short name' }]);
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
        'npx rozenite agent domains --cursor cursor',
      ),
    ).toEqual({
      items: [{ id: 'a' }],
      next: 'npx rozenite agent domains --cursor cursor',
    });
  });

  it('uses the selected schema for expanded tool rows', () => {
    expect(
      shapeToolResult(
        {
          items: [{ id: 'a', extra: 'not selected' }],
          page: { limit: 1, hasMore: false },
        },
        ['name', 'id'],
        undefined,
      ),
    ).toEqual({ items: [{ id: 'a' }] });
  });

  it('omits absent fields (not null) from row-keyed items, unlike columnar rows', () => {
    expect(
      shapePaginatedRows(
        { items: [{ id: 'a' }], page: { limit: 20, hasMore: false } },
        ['id', 'kind'],
        undefined,
      ),
    ).toEqual({ items: [{ id: 'a' }] });

    expect(
      shapePaginatedRows(
        { items: [], page: { limit: 20, hasMore: false } },
        ['id', 'kind'],
        undefined,
      ),
    ).toEqual({ items: [] });
  });

  it('degrades to unshaped when tool metadata collides with a shaped output key', () => {
    const collidingResult = {
      cols: 'tool-owned-value',
      items: [{ id: 'a' }, { id: 'b' }],
      page: { limit: 2, hasMore: false },
    };
    expect(shapeToolResult(collidingResult, ['id'], undefined)).toBe(
      collidingResult,
    );

    const collidingNext = {
      next: 'tool-owned-value',
      items: [{ id: 'a' }],
      page: { limit: 1, hasMore: true, nextCursor: 'cursor' },
    };
    expect(
      shapeToolResult(
        collidingNext,
        ['id'],
        'npx rozenite agent domains --cursor cursor',
      ),
    ).toBe(collidingNext);
  });

  it('makes next commands safe to paste into a POSIX shell', () => {
    expect(
      formatAgentCommand(['domains', '--session', "session with ' quote"]),
    ).toBe("npx rozenite agent domains --session 'session with '\"'\"' quote'");
  });

  it('emits slash-containing domain ids unquoted and shell-safe', () => {
    expect(
      formatAgentCommand(['avasapp/ably', 'tools', '--cursor', 'cursor']),
    ).toBe('npx rozenite agent avasapp/ably tools --cursor cursor');
  });

  it('does not hide a malformed continuation from a known tool result', () => {
    const result = {
      items: [{ id: 'a' }, { id: 'b' }],
      page: { limit: 2, hasMore: true },
    };

    expect(shapeToolResult(result, ['id'], undefined)).toBe(result);
  });

  it('leaves malformed paginated envelopes untouched without throwing', () => {
    const malformed = [
      null,
      1,
      { items: [null], page: { limit: 1, hasMore: false } },
      { items: [1], page: { limit: 1, hasMore: false } },
      { items: [[]], page: { limit: 1, hasMore: false } },
      { items: [], page: null },
      { items: [], page: { limit: Number.NaN, hasMore: false } },
      { items: [], page: { limit: Number.POSITIVE_INFINITY, hasMore: false } },
      { items: [], page: { limit: Number.NEGATIVE_INFINITY, hasMore: false } },
      { items: [], page: { limit: 0, hasMore: false } },
      { items: [], page: { limit: 1, hasMore: 'false' } },
      { items: [], page: { limit: 1, hasMore: false, nextCursor: 1 } },
    ];

    for (const result of malformed) {
      expect(shapeToolResult(result, ['id'], undefined)).toBe(result);
    }
  });

  it('preserves reset metadata on terminal and continued tool pages', () => {
    expect(
      shapeToolResult(
        {
          items: [{ id: 'a' }],
          page: { limit: 1, hasMore: false, reset: true },
        },
        ['id'],
        undefined,
      ),
    ).toEqual({ page: { reset: true }, items: [{ id: 'a' }] });
    expect(
      shapeToolResult(
        {
          items: [{ id: 'a' }],
          page: { limit: 1, hasMore: true, nextCursor: 'cursor', reset: true },
        },
        ['id'],
        'npx rozenite agent react call --cursor cursor',
      ),
    ).toEqual({
      page: { reset: true },
      items: [{ id: 'a' }],
      next: 'npx rozenite agent react call --cursor cursor',
    });
  });

  it('clamps limit to max range', () => {
    expect(parseLimit('500')).toBe(100);
  });
});
