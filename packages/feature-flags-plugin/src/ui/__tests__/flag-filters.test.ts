import { describe, expect, it } from 'vitest';
import type { FeatureFlag } from '../../shared/types';
import { filterFlags } from '../flag-filters';

const flag = (key: string, overridden: boolean): FeatureFlag => ({
  key,
  type: 'boolean',
  value: true,
  overridden,
});

describe('filterFlags', () => {
  const flags = [flag('new-onboarding', true), flag('dark-mode', false), flag('beta-search', true)];

  it('returns every flag when search is empty and overriddenOnly is false', () => {
    expect(filterFlags(flags, '', false)).toEqual(flags);
  });

  it('filters by a case-insensitive substring match on key', () => {
    expect(filterFlags(flags, 'DARK', false)).toEqual([flag('dark-mode', false)]);
  });

  it('trims whitespace from the search term', () => {
    expect(filterFlags(flags, '  dark  ', false)).toEqual([flag('dark-mode', false)]);
  });

  it('restricts to overridden flags when overriddenOnly is true', () => {
    expect(filterFlags(flags, '', true)).toEqual([
      flag('new-onboarding', true),
      flag('beta-search', true),
    ]);
  });

  it('combines search and overriddenOnly', () => {
    expect(filterFlags(flags, 'beta', true)).toEqual([flag('beta-search', true)]);
    expect(filterFlags(flags, 'dark', true)).toEqual([]);
  });
});
