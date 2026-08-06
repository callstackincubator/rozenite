import { describe, expect, it } from 'vitest';
import { TEXT_CHUNK_SIZE, textRowRanges } from '../large-value-viewer-state';

describe('textRowRanges', () => {
  it('indexes chunks without splitting a pathological single line', () => {
    const value = 'x'.repeat(TEXT_CHUNK_SIZE * 2 + 7);

    expect(textRowRanges(value)).toEqual([
      [0, TEXT_CHUNK_SIZE],
      [TEXT_CHUNK_SIZE, TEXT_CHUNK_SIZE * 2],
      [TEXT_CHUNK_SIZE * 2, value.length],
    ]);
  });

  it('keeps newline boundaries in their displayed row', () => {
    expect(textRowRanges('first\nsecond')).toEqual([
      [0, 6],
      [6, 12],
    ]);
  });
});
