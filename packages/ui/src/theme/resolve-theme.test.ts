import { describe, expect, it } from 'vitest';
import { resolveInitialTheme } from './resolve-theme';

describe('resolveInitialTheme', () => {
  it('uses the stored preference when it is "light"', () => {
    expect(resolveInitialTheme('light', true)).toBe('light');
  });

  it('uses the stored preference when it is "dark"', () => {
    expect(resolveInitialTheme('dark', false)).toBe('dark');
  });

  it('falls back to the media query when nothing is stored', () => {
    expect(resolveInitialTheme(null, true)).toBe('dark');
    expect(resolveInitialTheme(null, false)).toBe('light');
  });

  it('ignores an unrecognized stored value', () => {
    expect(resolveInitialTheme('system', true)).toBe('dark');
  });
});
