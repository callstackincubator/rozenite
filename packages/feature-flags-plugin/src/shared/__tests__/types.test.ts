import { describe, expect, it } from 'vitest';
import { inferFlagType, isValueOfType } from '../types';

describe('inferFlagType', () => {
  it('infers boolean', () => {
    expect(inferFlagType(true)).toBe('boolean');
  });

  it('infers number', () => {
    expect(inferFlagType(42)).toBe('number');
  });

  it('infers string', () => {
    expect(inferFlagType('variant-a')).toBe('string');
  });

  it('infers json for objects', () => {
    expect(inferFlagType({ theme: 'dark' })).toBe('json');
  });

  it('infers json for arrays', () => {
    expect(inferFlagType([1, 2, 3])).toBe('json');
  });

  it('infers json for null', () => {
    expect(inferFlagType(null)).toBe('json');
  });
});

describe('isValueOfType', () => {
  it('accepts a matching boolean', () => {
    expect(isValueOfType('boolean', false)).toBe(true);
  });

  it('rejects a non-boolean for boolean', () => {
    expect(isValueOfType('boolean', 'true')).toBe(false);
  });

  it('accepts a matching number', () => {
    expect(isValueOfType('number', 3.14)).toBe(true);
  });

  it('accepts a matching string', () => {
    expect(isValueOfType('string', 'variant-a')).toBe(true);
  });

  it('accepts any JSON-serializable value for json, including primitives', () => {
    expect(isValueOfType('json', { a: [1, 'b', false, null] })).toBe(true);
    expect(isValueOfType('json', [1, 2, 3])).toBe(true);
    expect(isValueOfType('json', 'x')).toBe(true);
    expect(isValueOfType('json', 1)).toBe(true);
    expect(isValueOfType('json', true)).toBe(true);
    expect(isValueOfType('json', null)).toBe(true);
  });

  it('rejects non-JSON-serializable values for json', () => {
    expect(isValueOfType('json', undefined)).toBe(false);
    expect(isValueOfType('json', () => {})).toBe(false);
    expect(isValueOfType('json', { a: undefined })).toBe(false);
  });
});
