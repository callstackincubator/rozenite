import { describe, expect, it } from 'vitest';
import { formatFrameLocation, formatSourcePath } from '../format';

describe('formatSourcePath', () => {
  it('extracts the apps/ workspace suffix from a long absolute path', () => {
    expect(
      formatSourcePath('/Users/me/code/myapp/apps/playground/src/Screen.tsx'),
    ).toBe('apps/playground/src/Screen.tsx');
  });

  it('extracts the packages/ workspace suffix', () => {
    expect(
      formatSourcePath('/Users/me/code/myapp/packages/shared/src/util.ts'),
    ).toBe('packages/shared/src/util.ts');
  });

  it('returns the bundle filename for Metro bundle URLs', () => {
    expect(
      formatSourcePath(
        'http://localhost:8081/index.bundle?platform=ios&dev=true',
      ),
    ).toBe('index.bundle');
  });

  it('strips query string and hash before matching', () => {
    expect(formatSourcePath('/abs/apps/foo/src/x.ts?bar=1#frag')).toBe(
      'apps/foo/src/x.ts',
    );
  });

  it('falls back to the last few segments for non-workspace URLs', () => {
    expect(formatSourcePath('https://example.com/a/b/c/d.ts')).toBe('d.ts');
  });
});

describe('formatFrameLocation', () => {
  it('returns null when the frame has no url at all', () => {
    expect(formatFrameLocation({})).toBeNull();
    expect(formatFrameLocation(undefined)).toBeNull();
  });

  it('formats source-mapped frames as path:line:col', () => {
    expect(
      formatFrameLocation({
        url: '/abs/apps/playground/src/Screen.tsx',
        lineNumber: 42,
        columnNumber: 5,
      }),
    ).toBe('apps/playground/src/Screen.tsx:42:5');
  });

  it('falls back to the generated URL when no source-mapped url is present', () => {
    expect(
      formatFrameLocation({
        generatedUrl: 'http://localhost:8081/index.bundle',
        generatedLineNumber: 1,
        generatedColumnNumber: 2,
      }),
    ).toBe('index.bundle:1:2');
  });
});
