import { describe, expect, it } from 'vitest';
import { createSymbolicationCache } from '../cache';

describe('createSymbolicationCache', () => {
  it('returns undefined on a miss', () => {
    const cache = createSymbolicationCache<string>(8);
    expect(cache.get('nope')).toBeUndefined();
  });

  it('returns the stored value on a hit', () => {
    const cache = createSymbolicationCache<{ id: number }>(8);
    cache.set('k', { id: 7 });
    expect(cache.get('k')).toEqual({ id: 7 });
  });

  it('evicts the least recently used entry once capacity is exceeded', () => {
    const cache = createSymbolicationCache<number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Touch 'a' to mark it as recently used; 'b' becomes the LRU.
    cache.get('a');
    cache.set('d', 4);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('overwrites an existing value without growing past capacity', () => {
    const cache = createSymbolicationCache<number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 99);
    expect(cache.size()).toBe(2);
    expect(cache.get('a')).toBe(99);
    expect(cache.get('b')).toBe(2);
  });
});
