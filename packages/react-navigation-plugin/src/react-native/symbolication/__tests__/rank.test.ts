import { describe, expect, it } from 'vitest';
import { classifyFrame, pickOriginFrame } from '../rank';
import type { ActionStackFrame } from '../types';

const frame = (
  overrides: Partial<ActionStackFrame> = {},
): ActionStackFrame => ({
  ...overrides,
});

describe('classifyFrame', () => {
  it('returns "unknown" when no url is provided', () => {
    expect(classifyFrame(undefined)).toBe('unknown');
  });

  it('returns "app" for paths outside node_modules', () => {
    expect(classifyFrame('apps/playground/src/Screen.tsx')).toBe('app');
    expect(classifyFrame('/Users/me/code/myapp/src/index.ts')).toBe('app');
    expect(classifyFrame('packages/shared/src/util.ts')).toBe('app');
  });

  it('returns "library" for paths under node_modules', () => {
    expect(classifyFrame('node_modules/react/index.js')).toBe('library');
    expect(
      classifyFrame('/abs/node_modules/@react-navigation/native/lib/foo.js'),
    ).toBe('library');
    expect(classifyFrame('apps/x/node_modules/react/index.js')).toBe('library');
  });
});

describe('pickOriginFrame', () => {
  it('prefers the first app frame as high confidence', () => {
    const frames = [
      frame({ url: 'node_modules/@react-navigation/core/dispatch.js' }),
      frame({ url: 'node_modules/react/index.js' }),
      frame({ url: 'apps/playground/src/Screen.tsx', functionName: 'handle' }),
      frame({ url: 'apps/playground/src/App.tsx' }),
    ];
    const result = pickOriginFrame(frames);
    expect(result.confidence).toBe('high');
    expect(result.frame?.functionName).toBe('handle');
  });

  it('falls back to the first source-mapped library frame as low confidence', () => {
    const frames = [
      frame({ url: 'node_modules/@react-navigation/core/dispatch.js' }),
      frame({ url: 'node_modules/react/index.js' }),
    ];
    const result = pickOriginFrame(frames);
    expect(result.confidence).toBe('low');
    expect(result.frame?.url).toBe(
      'node_modules/@react-navigation/core/dispatch.js',
    );
  });

  it('returns the first frame with no source as "none" confidence', () => {
    // Frames have only generatedUrl (no source-mapped `url`) — Metro
    // either failed to symbolicate them or symbolication has not run.
    const frames = [
      frame({ generatedUrl: 'http://localhost:8081/index.bundle' }),
      frame({ generatedUrl: 'http://localhost:8081/index.bundle' }),
    ];
    const result = pickOriginFrame(frames);
    expect(result.confidence).toBe('none');
    expect(result.frame).toBe(frames[0]);
  });

  it('returns "none" with undefined frame for an empty input', () => {
    const result = pickOriginFrame([]);
    expect(result.confidence).toBe('none');
    expect(result.frame).toBeUndefined();
  });

  it('does not consider generatedUrl when classifying — only source url decides app vs library', () => {
    // A frame whose only resolution is the bundle URL is "unknown",
    // not "app", because we have no source path to inspect. This
    // matters during the pending state, before Metro symbolicates.
    const frames = [
      frame({
        generatedUrl:
          'http://localhost:8081/index.bundle?platform=ios&dev=true',
      }),
    ];
    expect(pickOriginFrame(frames).confidence).toBe('none');
  });
});
