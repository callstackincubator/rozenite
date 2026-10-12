import { describe, expect, it } from 'vitest';
import {
  parseFields,
  parseLimit,
  projectRows,
  shapePaginatedRows,
  shapeRowsResult,
  shapeToolResult,
} from '../output-shaping.js';

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
    const defaultFields = ['seq', 'timestamp', 'level', 'source', 'text'] as const;

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
    const defaultFields = ['seq', 'timestamp', 'level', 'source', 'text'] as const;

    const fields = parseFields(undefined, allFields, defaultFields, true);

    expect(fields).toEqual([...allFields]);
    expect(fields).toContain('argsPreview');
    expect(fields).toContain('context');
  });

  it('clamps limit to max range', () => {
    expect(parseLimit('500')).toBe(100);
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

    expect(projectRows([{ name: 'missing short name' }], ['shortName', 'name'])).toEqual([
      { shortName: null, name: 'missing short name' },
    ]);
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
      shapePaginatedRows({ items: [], page: { limit: 20, hasMore: false } }, ['id'], undefined),
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

  it('accepts any pre-rendered next-page affordance, not just shell commands', () => {
    // The shared envelope carries the cursor/position; each frontend renders
    // its own next-page affordance (a shell command for the CLI, a `page`
    // argument description for MCP, etc). This function must not assume
    // shell-command shape.
    expect(
      shapePaginatedRows(
        {
          items: [{ id: 'a' }],
          page: { limit: 1, hasMore: true, nextCursor: 'cursor' },
        },
        ['id'],
        'call again with page="cursor"',
      ),
    ).toEqual({
      items: [{ id: 'a' }],
      next: 'call again with page="cursor"',
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
    expect(shapeToolResult(collidingResult, ['id'], undefined)).toBe(collidingResult);

    const collidingNext = {
      next: 'tool-owned-value',
      items: [{ id: 'a' }],
      page: { limit: 1, hasMore: true, nextCursor: 'cursor' },
    };
    expect(
      shapeToolResult(collidingNext, ['id'], 'npx rozenite agent domains --cursor cursor'),
    ).toBe(collidingNext);
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

  it('treats --fields all as every declared field unless a field is named all', () => {
    expect(parseFields('all', ['id', 'name', 'extra'] as const, ['id'] as const, false)).toEqual([
      'id',
      'name',
      'extra',
    ]);
    expect(parseFields('all', ['id', 'all'] as const, ['id'] as const, false)).toEqual(['all']);
  });

  describe('pagination.itemsKey', () => {
    it('reads rows from the declared key and keeps it for expanded output', () => {
      expect(
        shapeToolResult(
          {
            path: '/docs',
            entries: [{ name: 'a.txt', type: 'file', size: 1 }],
            page: { limit: 20, hasMore: false },
          },
          ['name', 'type'],
          undefined,
          { itemsKey: 'entries' },
        ),
      ).toEqual({ path: '/docs', entries: [{ name: 'a.txt', type: 'file' }] });
    });

    it('encodes declared-key rows as columns at two or more rows', () => {
      expect(
        shapeToolResult(
          {
            entries: [{ name: 'a' }, { name: 'b' }],
            page: { limit: 20, hasMore: false },
          },
          ['name'],
          undefined,
          { itemsKey: 'entries' },
        ),
      ).toEqual({ cols: ['name'], rows: [['a'], ['b']] });
    });

    it('leaves the result alone when the declared key holds no rows', () => {
      const result = { items: [{ name: 'a' }], page: { limit: 20, hasMore: false } };
      expect(shapeToolResult(result, ['name'], undefined, { itemsKey: 'entries' })).toBe(result);
    });
  });

  describe('pagination.meta', () => {
    const result = {
      total: 3,
      recording: { isRecording: true, droppedCount: 0 },
      truncated: false,
      items: [{ id: 'a' }],
      page: { limit: 20, hasMore: false },
    };

    it('prints every metadata key when meta is undeclared', () => {
      expect(shapeToolResult(result, ['id'], undefined)).toEqual({
        total: 3,
        recording: { isRecording: true, droppedCount: 0 },
        truncated: false,
        items: [{ id: 'a' }],
      });
    });

    it('prints only the declared metadata keys, in declared order, skipping absent ones', () => {
      expect(
        shapeToolResult(result, ['id'], undefined, { meta: ['truncated', 'total', 'missing'] }),
      ).toEqual({ truncated: false, total: 3, items: [{ id: 'a' }] });
    });

    it('prints no metadata when meta is empty', () => {
      expect(shapeToolResult(result, ['id'], undefined, { meta: [] })).toEqual({
        items: [{ id: 'a' }],
      });
    });

    it('does not degrade on a colliding key the tool did not declare worth printing', () => {
      expect(
        shapeToolResult(
          { cols: 'tool-owned', items: [{ id: 'a' }], page: { limit: 20, hasMore: false } },
          ['id'],
          undefined,
          { meta: [] },
        ),
      ).toEqual({ items: [{ id: 'a' }] });
    });
  });

  describe('sparse-column elision', () => {
    const page = { limit: 20, hasMore: false };

    it('drops a column that is null or absent on every row of the page', () => {
      expect(
        shapePaginatedRows(
          {
            items: [
              { name: 'a', readOnly: true, destructive: null },
              { name: 'b', readOnly: null },
            ],
            page,
          },
          ['name', 'readOnly', 'destructive', 'idempotent'],
          undefined,
          { elideNullColumns: true },
        ),
      ).toEqual({
        cols: ['name', 'readOnly'],
        rows: [
          ['a', true],
          ['b', null],
        ],
      });
    });

    it('drops null values from an expanded row', () => {
      expect(
        shapePaginatedRows(
          { items: [{ id: 'a', fallback: null }], page },
          ['id', 'fallback'],
          undefined,
          {
            elideNullColumns: true,
          },
        ),
      ).toEqual({ items: [{ id: 'a' }] });
    });

    it('keeps null columns when elision is off, as for columns the caller named', () => {
      expect(
        shapeToolResult(
          { items: [{ id: 'a', status: null }, { id: 'b' }], page },
          ['id', 'status'],
          undefined,
          { elideNullColumns: false },
        ),
      ).toEqual({
        cols: ['id', 'status'],
        rows: [
          ['a', null],
          ['b', null],
        ],
      });
    });

    it('elides on tool pages when asked', () => {
      expect(
        shapeToolResult(
          { items: [{ id: 'a', status: null }, { id: 'b' }], page },
          ['id', 'status'],
          undefined,
          { elideNullColumns: true },
        ),
      ).toEqual({ cols: ['id'], rows: [['a'], ['b']] });
    });
  });

  describe('rows-declared results', () => {
    it('projects the declared key and encodes two or more rows as columns', () => {
      const result = {
        storages: [
          { id: 'mmkv', name: 'MMKV', adapter: 'mmkv', extra: 1 },
          { id: 'async', name: 'AsyncStorage', adapter: 'async-storage', extra: 2 },
        ],
        count: 2,
      };
      expect(shapeRowsResult(result, ['id', 'name'], { key: 'storages' })).toEqual({
        count: 2,
        cols: ['id', 'name'],
        rows: [
          ['mmkv', 'MMKV'],
          ['async', 'AsyncStorage'],
        ],
      });
      expect(
        shapeToolResult(result, ['id', 'name'], undefined, { paged: false, itemsKey: 'storages' }),
      ).toEqual(shapeRowsResult(result, ['id', 'name'], { key: 'storages' }));
    });

    it('keeps one row expanded under its own key', () => {
      expect(shapeRowsResult({ items: [{ id: 'a', name: 'A' }] }, ['id'])).toEqual({
        items: [{ id: 'a' }],
      });
    });

    it('leaves results without rows, or with colliding keys, unchanged', () => {
      const noRows = { storages: 'not a list' };
      expect(shapeRowsResult(noRows, ['id'], { key: 'storages' })).toBe(noRows);
      const notRecords = { items: [1, 2] };
      expect(shapeRowsResult(notRecords, ['id'])).toBe(notRecords);
      const colliding = { rows: 1, items: [{ id: 'a' }] };
      expect(shapeRowsResult(colliding, ['id'])).toBe(colliding);
    });
  });
});
