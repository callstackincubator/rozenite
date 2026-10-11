import { describe, expect, it } from 'vitest';
import { sliceUtf8 } from '../index.js';

const readAll = (text: string, maxBytes: number): string[] => {
  const slices: string[] = [];
  let offset: number | undefined = 0;
  while (offset !== undefined) {
    const result = sliceUtf8(text, { offset, maxBytes });
    slices.push(result.slice);
    offset = result.nextOffset;
  }
  return slices;
};

describe('sliceUtf8', () => {
  it('returns the whole text when it fits', () => {
    expect(sliceUtf8('hello', { maxBytes: 16 })).toEqual({
      slice: 'hello',
      totalBytes: 5,
      truncated: false,
    });
  });

  it('cuts ASCII at maxBytes and reports the next byte index', () => {
    expect(sliceUtf8('abcdef', { offset: 1, maxBytes: 3 })).toEqual({
      slice: 'bcd',
      totalBytes: 6,
      truncated: true,
      nextOffset: 4,
    });
  });

  it('never splits an emoji at the cut, and never exceeds maxBytes', () => {
    // "ab" is 2 bytes, the emoji 4 (a surrogate pair in UTF-16).
    const text = 'ab😀cd';
    const result = sliceUtf8(text, { maxBytes: 4 });
    expect(result).toEqual({ slice: 'ab', totalBytes: 8, truncated: true, nextOffset: 2 });
    expect(sliceUtf8(text, { offset: 2, maxBytes: 4 })).toEqual({
      slice: '😀',
      totalBytes: 8,
      truncated: true,
      nextOffset: 6,
    });
  });

  it('returns a character longer than maxBytes whole so a read always progresses', () => {
    expect(sliceUtf8('😀x', { maxBytes: 1 })).toEqual({
      slice: '😀',
      totalBytes: 5,
      truncated: true,
      nextOffset: 4,
    });
  });

  it('moves an offset inside a character forward to the next one', () => {
    expect(sliceUtf8('é😀z', { offset: 3, maxBytes: 10 })).toEqual({
      slice: 'z',
      totalBytes: 7,
      truncated: false,
    });
  });

  it('partitions text exactly when nextOffset is fed back as offset', () => {
    const text = 'a€😀b€😀c'.repeat(7);
    for (const maxBytes of [1, 2, 3, 4, 5, 7, 16]) {
      const slices = readAll(text, maxBytes);
      expect(slices.join(''), `maxBytes ${maxBytes}`).toBe(text);
      expect(slices.every((slice) => !/[\uD800-\uDBFF]$/.test(slice))).toBe(true);
    }
  });

  it('returns nothing past the end', () => {
    expect(sliceUtf8('abc', { offset: 10, maxBytes: 4 })).toEqual({
      slice: '',
      totalBytes: 3,
      truncated: false,
    });
  });

  it('rejects a non-positive maxBytes and a negative offset', () => {
    expect(() => sliceUtf8('abc', { maxBytes: 0 })).toThrow(
      '"maxBytes" must be a positive integer.',
    );
    expect(() => sliceUtf8('abc', { offset: -1, maxBytes: 1 })).toThrow(
      '"offset" must be a non-negative integer.',
    );
  });
});
