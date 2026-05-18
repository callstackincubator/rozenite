import { describe, expect, it } from 'vitest';
import { parseStack } from '../parse';

describe('parseStack', () => {
  it('returns an empty array for an empty string', () => {
    expect(parseStack('')).toEqual([]);
  });

  it('parses a V8-style function frame "at fn (file:line:col)"', () => {
    const stack = 'at handleClick (apps/playground/src/Screen.tsx:42:5)';
    expect(parseStack(stack)).toEqual([
      {
        functionName: 'handleClick',
        generatedUrl: 'apps/playground/src/Screen.tsx',
        generatedLineNumber: 42,
        generatedColumnNumber: 5,
      },
    ]);
  });

  it('parses a V8-style anonymous location frame "at file:line:col"', () => {
    const stack = 'at apps/playground/src/Screen.tsx:42:5';
    expect(parseStack(stack)).toEqual([
      {
        functionName: undefined,
        generatedUrl: 'apps/playground/src/Screen.tsx',
        generatedLineNumber: 42,
        generatedColumnNumber: 5,
      },
    ]);
  });

  it('parses a JSC-style frame "fn@file:line:col"', () => {
    const stack = 'handleClick@apps/playground/src/Screen.tsx:42:5';
    expect(parseStack(stack)).toEqual([
      {
        functionName: 'handleClick',
        generatedUrl: 'apps/playground/src/Screen.tsx',
        generatedLineNumber: 42,
        generatedColumnNumber: 5,
      },
    ]);
  });

  it('parses multiple frames in input order', () => {
    const stack = [
      'at dispatch (node_modules/@react-navigation/core/dispatch.js:10:1)',
      'at navigate (node_modules/@react-navigation/core/navigate.js:20:2)',
      'at handleClick (apps/playground/src/Screen.tsx:42:5)',
    ].join('\n');
    const frames = parseStack(stack);
    expect(frames).toHaveLength(3);
    expect(frames[0].functionName).toBe('dispatch');
    expect(frames[1].functionName).toBe('navigate');
    expect(frames[2].functionName).toBe('handleClick');
  });

  it('skips blank lines and malformed lines that match no frame format', () => {
    const stack = [
      '',
      '   ',
      'totally not a stack frame',
      'at handleClick (apps/playground/src/Screen.tsx:42:5)',
    ].join('\n');
    const frames = parseStack(stack);
    expect(frames).toHaveLength(1);
    expect(frames[0].functionName).toBe('handleClick');
  });

  it('drops "<anonymous>", "anonymous", and "<unknown>" function-name markers', () => {
    const stack = [
      'at <anonymous> (apps/playground/src/a.ts:1:1)',
      'at anonymous (apps/playground/src/b.ts:2:1)',
      'at <unknown> (apps/playground/src/c.ts:3:1)',
    ].join('\n');
    const frames = parseStack(stack);
    expect(frames.map((f) => f.functionName)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('caps the result at 50 frames', () => {
    const lines = Array.from(
      { length: 75 },
      (_, i) => `at frame${i} (apps/playground/src/x.ts:${i}:1)`,
    );
    const frames = parseStack(lines.join('\n'));
    expect(frames).toHaveLength(50);
    // The first 50 should match input order — verifies it slices the
    // head, not the tail.
    expect(frames[0].functionName).toBe('frame0');
    expect(frames[49].functionName).toBe('frame49');
  });
});
