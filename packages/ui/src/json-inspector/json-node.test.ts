import { describe, expect, it } from 'vitest';
import {
  classifyValue,
  getChildKeys,
  getContainerSummary,
  isExpandable,
} from './json-node';

describe('classifyValue', () => {
  it('classifies primitives', () => {
    expect(classifyValue('a')).toBe('string');
    expect(classifyValue(1)).toBe('number');
    expect(classifyValue(true)).toBe('boolean');
    expect(classifyValue(undefined)).toBe('undefined');
    expect(classifyValue(10n)).toBe('bigint');
  });

  it('classifies null distinctly from object', () => {
    expect(classifyValue(null)).toBe('null');
    expect(classifyValue({})).toBe('object');
  });

  it('classifies arrays distinctly from objects', () => {
    expect(classifyValue([])).toBe('array');
    expect(classifyValue([1, 2])).toBe('array');
  });
});

describe('isExpandable', () => {
  it('is true only for objects and arrays', () => {
    expect(isExpandable({})).toBe(true);
    expect(isExpandable([])).toBe(true);
    expect(isExpandable(null)).toBe(false);
    expect(isExpandable('string')).toBe(false);
    expect(isExpandable(42)).toBe(false);
  });
});

describe('getChildKeys', () => {
  it('returns stringified indices for arrays', () => {
    expect(getChildKeys(['a', 'b', 'c'])).toEqual(['0', '1', '2']);
  });

  it('returns own enumerable keys for objects', () => {
    expect(getChildKeys({ b: 1, a: 2 })).toEqual(['b', 'a']);
  });

  it('returns undefined for leaf values', () => {
    expect(getChildKeys('a')).toBeUndefined();
    expect(getChildKeys(1)).toBeUndefined();
    expect(getChildKeys(null)).toBeUndefined();
  });
});

describe('getContainerSummary', () => {
  it('summarises arrays with bracket count', () => {
    expect(getContainerSummary([1, 2, 3])).toBe('[3]');
    expect(getContainerSummary([])).toBe('[0]');
  });

  it('summarises objects with brace count', () => {
    expect(getContainerSummary({ a: 1, b: 2 })).toBe('{2}');
    expect(getContainerSummary({})).toBe('{0}');
  });
});
