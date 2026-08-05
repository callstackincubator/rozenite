import { describe, expect, it } from 'vitest';
import { updateCellValue } from './data-table-utils';

describe('updateCellValue', () => {
  const data = [
    { key: 'a', value: '1' },
    { key: 'b', value: '2' },
  ];

  it('replaces the field on the targeted row', () => {
    const result = updateCellValue(data, 1, 'value', '99');
    expect(result[1]).toEqual({ key: 'b', value: '99' });
  });

  it('leaves other rows untouched', () => {
    const result = updateCellValue(data, 1, 'value', '99');
    expect(result[0]).toBe(data[0]);
  });

  it('does not mutate the original array or row', () => {
    const result = updateCellValue(data, 0, 'key', 'z');
    expect(data[0].key).toBe('a');
    expect(result).not.toBe(data);
    expect(result[0]).not.toBe(data[0]);
  });

  it('is a no-op replacement when the row index is out of range', () => {
    const result = updateCellValue(data, 5, 'value', 'x');
    expect(result).toEqual(data);
  });
});
