import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NativeModules } from 'react-native';
import { __resetMetroOriginCache, resolveMetroOrigin, symbolicateFrames } from '../metro';

vi.mock('react-native', () => ({
  NativeModules: {
    SourceCode: {
      scriptURL: undefined,
    },
  },
}));

describe('redux trace Metro symbolication', () => {
  beforeEach(() => {
    __resetMetroOriginCache();
    NativeModules.SourceCode.scriptURL = undefined;
  });

  it('resolves the Metro origin from SourceCode.scriptURL', () => {
    NativeModules.SourceCode.scriptURL =
      'http://10.0.2.2:8081/index.bundle?platform=android';

    expect(resolveMetroOrigin()).toBe('http://10.0.2.2:8081');
  });

  it('posts generated frames to Metro symbolicate and preserves original indexes', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stack: [
          {
            methodName: 'dispatchAction',
            file: '/app/src/store.ts',
            lineNumber: 12,
            column: 3,
          },
        ],
        codeFrame: {
          fileName: '/app/src/store.ts',
          content: '\u001b[31mconst action = makeAction()\u001b[39m',
          location: { row: 12, column: 3 },
        },
      }),
    });

    await expect(
      symbolicateFrames(
        [
          { generatedUrl: 'native', generatedLineNumber: 1, generatedColumnNumber: 1 },
          {
            functionName: 'dispatchAction',
            generatedUrl: 'http://localhost:8081/index.bundle',
            generatedLineNumber: 100,
            generatedColumnNumber: 20,
          },
        ],
        { origin: 'http://localhost:8081', fetch },
      ),
    ).resolves.toEqual({
      status: 'complete',
      frames: [
        { generatedUrl: 'native', generatedLineNumber: 1, generatedColumnNumber: 1 },
        {
          functionName: 'dispatchAction',
          url: '/app/src/store.ts',
          lineNumber: 12,
          columnNumber: 3,
          generatedUrl: 'http://localhost:8081/index.bundle',
          generatedLineNumber: 100,
          generatedColumnNumber: 20,
          isCollapsed: undefined,
        },
      ],
      codeFrame: {
        fileName: '/app/src/store.ts',
        content: 'const action = makeAction()',
        line: 12,
        column: 3,
      },
    });

    expect(fetch).toHaveBeenCalledWith('http://localhost:8081/symbolicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stack: [
          {
            methodName: 'dispatchAction',
            file: 'http://localhost:8081/index.bundle',
            lineNumber: 100,
            column: 20,
          },
        ],
      }),
      signal: expect.any(AbortSignal),
    });
  });
});
