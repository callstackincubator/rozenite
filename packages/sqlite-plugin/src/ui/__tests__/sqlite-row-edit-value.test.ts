import { describe, expect, it } from 'vitest';
import type { SqliteColumnInfo } from '../sqlite-introspection';
import { getEditableColumns } from '../sqlite-row-mutations';
import { createFieldDraft, parseEditableFieldValue } from '../sqlite-row-edit-value';

const column = (overrides: Partial<SqliteColumnInfo> & Pick<SqliteColumnInfo, 'name' | 'type'>) =>
  ({
    cid: 0,
    notNull: false,
    defaultValue: null,
    primaryKeyOrder: 0,
    hidden: 0,
    ...overrides,
  }) satisfies SqliteColumnInfo;

describe('sqlite row edit value helpers', () => {
  it('converts blob-ish drafts into Uint8Array bind values', () => {
    expect(
      parseEditableFieldValue({
        kind: 'blob-ish',
        rawValue: '[1, 2, 255]',
      }),
    ).toEqual(new Uint8Array([1, 2, 255]));
  });

  it('serializes json drafts into JSON text bind values', () => {
    expect(
      parseEditableFieldValue({
        kind: 'json',
        rawValue: '{\n  "ok": true,\n  "count": 2\n}',
      }),
    ).toBe('{"ok":true,"count":2}');
  });

  it('rejects an empty number draft instead of saving 0', () => {
    expect(() => parseEditableFieldValue({ kind: 'number', rawValue: '  ' })).toThrow(
      'Enter a valid number.',
    );
    expect(parseEditableFieldValue({ kind: 'number', rawValue: ' 0 ' })).toBe(0);
  });
});

describe('createFieldDraft', () => {
  const columns = [
    column({ name: 'id', type: 'INTEGER', primaryKeyOrder: 1, notNull: true }),
    column({ name: 'name', type: 'TEXT', notNull: true }),
    column({ name: 'age', type: 'INTEGER' }),
    column({ name: 'avatar', type: 'BLOB' }),
    column({ name: 'bio', type: 'TEXT' }),
    column({ name: 'settings', type: 'JSON' }),
  ];

  it('starts a NULL value in a nullable column as NULL', () => {
    for (const name of ['age', 'avatar', 'bio', 'settings']) {
      const nullable = columns.find((candidate) => candidate.name === name)!;

      expect(createFieldDraft(nullable, null)).toEqual({ kind: 'null', rawValue: '' });
    }
  });

  it('keeps the typed draft for a NULL in a NOT NULL column and for real values', () => {
    expect(createFieldDraft(columns[1], null).kind).toBe('text');
    expect(createFieldDraft(columns[2], 42)).toEqual({ kind: 'number', rawValue: '42' });
    expect(createFieldDraft(columns[4], 'hello')).toEqual({ kind: 'text', rawValue: 'hello' });
  });

  it('leaves every other NULL column NULL when one field is edited and saved', () => {
    const row = {
      id: 7,
      name: 'Ada',
      age: null,
      avatar: null,
      bio: null,
      settings: null,
    };
    const drafts = Object.fromEntries(
      getEditableColumns(columns).map((editable) => [
        editable.name,
        createFieldDraft(editable, row[editable.name as keyof typeof row]),
      ]),
    );

    drafts.name = { ...drafts.name, rawValue: 'Ada Lovelace' };

    const nextValues = Object.fromEntries(
      Object.entries(drafts).map(([name, draft]) => [name, parseEditableFieldValue(draft)]),
    );

    expect(nextValues).toEqual({
      name: 'Ada Lovelace',
      age: null,
      avatar: null,
      bio: null,
      settings: null,
    });
  });
});
