import { describe, expect, it } from 'vitest';
import { setDeep } from '../store-registry';

describe('setDeep', () => {
  it('edits and removes Set items by index, returning a real Set', () => {
    const tags = new Set(['a', 'b', 'c']);

    const edited = setDeep({ tags }, ['tags', 1], 'B', 'set') as { tags: Set<string> };
    expect(edited.tags).toBeInstanceOf(Set);
    expect([...edited.tags]).toEqual(['a', 'B', 'c']);

    const removed = setDeep({ tags }, ['tags', 0], undefined, 'remove') as { tags: Set<string> };
    expect([...removed.tags]).toEqual(['b', 'c']);
    expect([...tags]).toEqual(['a', 'b', 'c']);
  });

  it('edits a Map entry key or value in place, keeping entry order', () => {
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);

    const value = setDeep(map, [1, 1], 20, 'set') as Map<string, number>;
    expect([...value]).toEqual([
      ['a', 1],
      ['b', 20],
    ]);

    const key = setDeep(map, [0, 0], 'z', 'set') as Map<string, number>;
    expect([...key]).toEqual([
      ['z', 1],
      ['b', 2],
    ]);

    const removed = setDeep(map, [0], undefined, 'remove') as Map<string, number>;
    expect([...removed]).toEqual([['b', 2]]);
  });

  it('sets a whole Map entry from a [key, value] pair and refuses what it cannot apply', () => {
    const map = new Map([['a', 1]]);

    expect([...(setDeep(map, [0], ['b', 2], 'set') as Map<string, number>)]).toEqual([['b', 2]]);
    // Each of these used to return the Map unchanged, reported as applied.
    expect(() => setDeep(map, [0], 5, 'set')).toThrow(/\[key, value\] pair/);
    expect(() => setDeep(map, [3, 1], 5, 'set')).toThrow(/no entry 3/);
    expect(() => setDeep(map, [0, 0], undefined, 'remove')).toThrow(/replaced whole/);
  });
});
