import { describe, expect, it } from 'vitest';
import { getDirectoryLinkType } from '../fixture.js';

describe('getDirectoryLinkType', () => {
  it('uses a junction on Windows, where dir symlinks need elevated privileges', () => {
    expect(getDirectoryLinkType('win32')).toBe('junction');
  });

  it('uses a dir symlink elsewhere', () => {
    expect(getDirectoryLinkType('darwin')).toBe('dir');
    expect(getDirectoryLinkType('linux')).toBe('dir');
  });
});
