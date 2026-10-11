import { describe, expect, it } from 'vitest';
import {
  defineAgentToolDescriptors,
  definePaginatedAgentToolContract,
  defineRowsAgentToolContract,
  isAgentToolPagination,
  isAgentToolRows,
  type PageEnvelope,
} from '../index.js';

describe('isAgentToolPagination', () => {
  const base = { kind: 'cursor', fields: ['id', 'label'], defaultFields: ['id'] };

  it('accepts itemsKey and meta', () => {
    expect(isAgentToolPagination({ ...base, itemsKey: 'entries', meta: ['total'] })).toBe(true);
    expect(isAgentToolPagination({ ...base, meta: [] })).toBe(true);
  });

  it.each([
    ['empty itemsKey', { itemsKey: '' }],
    ['non-string itemsKey', { itemsKey: 1 }],
    ['non-array meta', { meta: 'total' }],
    ['duplicate meta', { meta: ['total', 'total'] }],
    ['empty meta key', { meta: [''] }],
  ])('rejects %s', (_, extra) => {
    expect(isAgentToolPagination({ ...base, ...extra })).toBe(false);
  });
});

describe('isAgentToolRows', () => {
  it('accepts rows with and without a key', () => {
    expect(isAgentToolRows({ fields: ['id'] })).toBe(true);
    expect(
      isAgentToolRows({ key: 'storages', fields: ['id', 'name'], defaultFields: ['id'] }),
    ).toBe(true);
  });

  it.each([
    ['non-object', ['id']],
    ['empty fields', { fields: [] }],
    ['duplicate fields', { fields: ['id', 'id'] }],
    ['default outside fields', { fields: ['id'], defaultFields: ['name'] }],
    ['empty defaults', { fields: ['id'], defaultFields: [] }],
    ['empty key', { key: '', fields: ['id'] }],
  ])('rejects %s', (_, value) => {
    expect(isAgentToolRows(value)).toBe(false);
  });
});

type StorageRow = { id: string; name: string; adapter: string };
type ListStoragesResult = { storages: StorageRow[] };

type EntryRow = { path: string; size: number };
type ListEntriesResult = { entries: EntryRow[]; page: PageEnvelope; total: number };

describe('list contracts', () => {
  it('carries rows and pagination metadata into descriptors', () => {
    const listStorages = defineRowsAgentToolContract<
      Record<string, never>,
      ListStoragesResult,
      'storages'
    >({
      name: 'list-storages',
      description: 'List storages',
      inputSchema: { type: 'object', properties: {} },
      rows: { key: 'storages', fields: ['id', 'name', 'adapter'], defaultFields: ['id', 'name'] },
    });
    const listEntries = definePaginatedAgentToolContract<
      Record<string, never>,
      ListEntriesResult,
      'entries'
    >({
      name: 'list-entries',
      description: 'List entries',
      inputSchema: { type: 'object', properties: {} },
      pagination: {
        kind: 'cursor',
        itemsKey: 'entries',
        fields: ['path', 'size'],
        meta: ['total'],
      },
    });

    const descriptors = defineAgentToolDescriptors('storage', { listStorages, listEntries });

    expect(descriptors.listStorages.rows).toEqual({
      key: 'storages',
      fields: ['id', 'name', 'adapter'],
      defaultFields: ['id', 'name'],
    });
    expect(descriptors.listEntries.pagination).toEqual({
      kind: 'cursor',
      itemsKey: 'entries',
      fields: ['path', 'size'],
      meta: ['total'],
    });
  });

  it('ties declared fields to the row type at compile time', () => {
    const declare = () =>
      defineRowsAgentToolContract<Record<string, never>, ListStoragesResult, 'storages'>({
        name: 'list-storages',
        description: 'List storages',
        inputSchema: { type: 'object', properties: {} },
        // @ts-expect-error -- `size` is not a StorageRow field
        rows: { key: 'storages', fields: ['id', 'size'] },
      });
    const declareMeta = () =>
      definePaginatedAgentToolContract<Record<string, never>, ListEntriesResult, 'entries'>({
        name: 'list-entries',
        description: 'List entries',
        inputSchema: { type: 'object', properties: {} },
        // @ts-expect-error -- `missing` is not a top-level result key
        pagination: { kind: 'cursor', itemsKey: 'entries', fields: ['path'], meta: ['missing'] },
      });

    expect(declare).not.toThrow();
    expect(declareMeta).not.toThrow();
  });

  it('rejects invalid rows metadata at runtime', () => {
    expect(() =>
      defineRowsAgentToolContract<Record<string, never>, ListStoragesResult, 'storages'>({
        name: 'list-storages',
        description: 'List storages',
        inputSchema: { type: 'object', properties: {} },
        rows: { key: 'storages', fields: ['id'], defaultFields: ['name'] },
      }),
    ).toThrow('Agent tool rows must declare');
  });
});
