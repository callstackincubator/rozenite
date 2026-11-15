import { describe, expect, it } from 'vitest';
import type { EncodedValue } from '../../../shared/codec';
import { editText, isEditableLeaf, parseUserValue, pathKey, searchTree } from '../encoded';

describe('editing a value', () => {
  const values: EncodedValue[] = [
    { $t: 'date', v: '2026-11-05T00:00:00.000Z' },
    { $t: 'regexp', source: 'a+', flags: 'gi' },
    { $t: 'inf' },
    { $t: 'inf', neg: true },
    { $t: 'bigint', v: '12' },
    { $t: 'nan' },
    { $t: 'negzero' },
    { $t: 'undef' },
    'text',
    3,
    null,
  ];

  it.each(values.map((value) => [JSON.stringify(value), value]))(
    'reads the edit text of %s back as the same value',
    (_label, value) => {
      expect(parseUserValue(editText(value as EncodedValue))).toEqual({ ok: true, value });
    },
  );

  it('offers no edit for values an edit cannot give back as they were', () => {
    expect(isEditableLeaf({ $t: 'symbol', v: 'id' })).toBe(false);
    expect(isEditableLeaf({ $t: 'error', name: 'TypeError', message: 'x' })).toBe(false);
    expect(isEditableLeaf({ $t: 'typed', kind: 'Uint8Array', v: [1, 2, 3] })).toBe(false);
    expect(isEditableLeaf({ $t: 'typed', kind: 'ArrayBuffer', v: [0] })).toBe(false);
    expect(isEditableLeaf({ $t: 'fn', name: 'go', arity: 0 })).toBe(false);
    expect(isEditableLeaf({ $t: 'ref', path: [] })).toBe(false);
    expect(isEditableLeaf({ $t: 'date', v: '2026-11-05T00:00:00.000Z' })).toBe(true);
  });
});

describe('searching a tree', () => {
  const state: EncodedValue = { user: { id: 7, name: 'Ada' }, cart: { total: 3 } };
  const keys = (query: string) => [...searchTree(state, query)].sort();
  const paths = (...list: (string | number)[][]) => list.map(pathKey).sort();

  it('shows what is inside a container whose key matched', () => {
    expect(keys('user')).toEqual(paths([], ['user'], ['user', 'id'], ['user', 'name']));
  });

  it('shows only the way to a matching leaf', () => {
    expect(keys('ada')).toEqual(paths([], ['user'], ['user', 'name']));
  });
});
