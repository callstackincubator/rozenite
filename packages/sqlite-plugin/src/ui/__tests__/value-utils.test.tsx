import { describe, expect, it } from 'vitest';
import { getValuePreview, stringifyValue } from '../value-utils';

describe('value utils', () => {
  it('stringifyValue returns a string for undefined values', () => {
    expect(stringifyValue(undefined)).toBe('undefined');
  });

  it('getValuePreview does not crash for undefined values', () => {
    expect(getValuePreview(undefined)).toBe('undefined');
  });
});
