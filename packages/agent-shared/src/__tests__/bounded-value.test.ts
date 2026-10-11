import { describe, expect, it } from 'vitest';
import { boundValue, normalizeBoundedValueArgs, truncateString } from '../index.js';

describe('boundValue', () => {
  it('returns small values unchanged', () => {
    const value = { a: 1, b: ['x', null, true], c: { d: 'e' } };
    expect(boundValue(value)).toEqual({ value, truncated: false });
  });

  it('cuts long strings and marks how much was left out', () => {
    expect(boundValue('abcdef', { maxValueLength: 4 })).toEqual({
      value: 'abcd[+2 chars]',
      truncated: true,
    });
  });

  it('never splits a surrogate pair when an emoji sits at the cut', () => {
    // 'ab' then an emoji (two UTF-16 units); a cut at 3 would keep half of it.
    const result = boundValue({ text: 'ab😀cd' }, { maxValueLength: 3 });
    expect(result).toEqual({ value: { text: 'ab[+4 chars]' }, truncated: true });
    expect(truncateString('😀', 1)).toEqual({ text: '[+2 chars]', truncated: true });
  });

  it('collapses containers below maxDepth', () => {
    expect(boundValue({ a: { b: { c: 1 } }, l: [[1, 2]] }, { maxDepth: 1 })).toEqual({
      value: { a: '[object(1 keys)]', l: '[array(1)]' },
      truncated: true,
    });
  });

  it('caps a 5 000-entry array and object at maxItems per level', () => {
    const todos = Array.from({ length: 5_000 }, (_, id) => ({ id, title: `todo ${id}` }));
    const byId = Object.fromEntries(todos.map((todo) => [String(todo.id), todo]));

    const list = boundValue(todos);
    expect(list.truncated).toBe(true);
    const items = list.value as unknown[];
    expect(items).toHaveLength(101);
    expect(items[99]).toEqual({ id: 99, title: 'todo 99' });
    expect(items[100]).toBe('[+4900 items]');

    const map = boundValue({ byId }, { maxItems: 3 });
    expect(map).toEqual({
      value: {
        byId: {
          '0': { id: 0, title: 'todo 0' },
          '1': { id: 1, title: 'todo 1' },
          '2': { id: 2, title: 'todo 2' },
          '[+4997 keys]': true,
        },
      },
      truncated: true,
    });
    expect(JSON.stringify(boundValue({ byId }).value).length).toBeLessThan(5_000);
  });

  it('selects a path before bounding', () => {
    expect(boundValue({ a: { b: ['x', 'y'] } }, { path: 'a.b.1' })).toEqual({
      value: 'y',
      truncated: false,
    });
    expect(() => boundValue({ a: {} }, { path: 'a.missing' })).toThrow(
      'Path "a.missing" does not exist.',
    );
  });

  it('marks circular references', () => {
    const value: Record<string, unknown> = { name: 'loop' };
    value.self = value;
    expect(boundValue(value).value).toEqual({ name: 'loop', self: '[circular]' });
  });

  it('validates the bounds and caps them at their maximum', () => {
    expect(normalizeBoundedValueArgs({})).toEqual({
      path: undefined,
      maxDepth: 4,
      maxValueLength: 512,
      maxItems: 100,
    });
    expect(normalizeBoundedValueArgs({ maxItems: 50_000, maxDepth: 100 })).toMatchObject({
      maxItems: 10_000,
      maxDepth: 64,
    });
    expect(() => normalizeBoundedValueArgs({ maxItems: 0 })).toThrow(
      '"maxItems" must be an integer of at least 1.',
    );
  });
});
