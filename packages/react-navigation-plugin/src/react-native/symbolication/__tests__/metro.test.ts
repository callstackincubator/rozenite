import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock react-native BEFORE importing the module under test so the
// mocked `NativeModules.SourceCode.scriptURL` is what
// `resolveMetroOrigin` reads.
const mockScriptURL = vi.hoisted(() => ({
  value: undefined as string | undefined,
}));

vi.mock('react-native', () => ({
  NativeModules: {
    get SourceCode() {
      return { scriptURL: mockScriptURL.value };
    },
  },
}));

import {
  __resetMetroOriginCache,
  resolveMetroOrigin,
  symbolicateFrames,
} from '../metro';
import type { ActionStackFrame } from '../types';

beforeEach(() => {
  __resetMetroOriginCache();
  mockScriptURL.value = undefined;
});

describe('resolveMetroOrigin', () => {
  it('returns null when NativeModules.SourceCode.scriptURL is undefined', () => {
    mockScriptURL.value = undefined;
    expect(resolveMetroOrigin()).toBeNull();
  });

  it('returns null for file:// schemes (release builds)', () => {
    mockScriptURL.value = 'file:///var/containers/Bundle/.../main.jsbundle';
    expect(resolveMetroOrigin()).toBeNull();
  });

  it('returns the http origin for a Metro bundle URL', () => {
    mockScriptURL.value =
      'http://10.0.2.2:8081/index.bundle?platform=android&dev=true';
    expect(resolveMetroOrigin()).toBe('http://10.0.2.2:8081');
  });

  it('caches the resolution across calls', () => {
    mockScriptURL.value = 'http://localhost:8081/index.bundle';
    const first = resolveMetroOrigin();
    // Subsequent change to scriptURL must not affect the cached value.
    mockScriptURL.value = 'http://different.host:9999/index.bundle';
    expect(resolveMetroOrigin()).toBe(first);
  });
});

const sampleFrame = (
  overrides: Partial<ActionStackFrame> = {},
): ActionStackFrame => ({
  functionName: 'handleClick',
  generatedUrl: 'http://localhost:8081/index.bundle?platform=ios&dev=true',
  generatedLineNumber: 12345,
  generatedColumnNumber: 10,
  ...overrides,
});

describe('symbolicateFrames', () => {
  it('returns "unavailable" when no Metro origin is reachable', async () => {
    const result = await symbolicateFrames([sampleFrame()], {
      origin: null,
    });
    expect(result.status).toBe('unavailable');
    expect(result.frames).toHaveLength(1);
  });

  it('returns "unavailable" when no frame has a generatedUrl to symbolicate', async () => {
    const fetchSpy = vi.fn();
    const result = await symbolicateFrames([{ functionName: 'noUrl' }], {
      origin: 'http://localhost:8081',
      fetch: fetchSpy,
    });
    expect(result.status).toBe('unavailable');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts the right body shape and maps Metro response onto source-mapped frames', async () => {
    const fetchSpy = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            stack: [
              {
                methodName: 'handleClick',
                file: 'apps/playground/src/Screen.tsx',
                lineNumber: 42,
                column: 5,
                collapse: false,
              },
            ],
          }),
          { status: 200 },
        ),
    );
    const result = await symbolicateFrames([sampleFrame()], {
      origin: 'http://localhost:8081',
      fetch: fetchSpy as typeof globalThis.fetch,
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [callUrl, callInit] = fetchSpy.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(callUrl).toBe('http://localhost:8081/symbolicate');
    expect(callInit.method).toBe('POST');
    expect(JSON.parse(callInit.body as string)).toEqual({
      stack: [
        {
          methodName: 'handleClick',
          file: 'http://localhost:8081/index.bundle?platform=ios&dev=true',
          lineNumber: 12345,
          column: 10,
        },
      ],
    });

    expect(result.status).toBe('complete');
    if (result.status !== 'complete') return; // type narrowing
    expect(result.frames[0]).toMatchObject({
      functionName: 'handleClick',
      url: 'apps/playground/src/Screen.tsx',
      lineNumber: 42,
      columnNumber: 5,
      generatedUrl: 'http://localhost:8081/index.bundle?platform=ios&dev=true',
      generatedLineNumber: 12345,
      generatedColumnNumber: 10,
      isCollapsed: false,
    });
  });

  it('strips ANSI escape sequences from the codeFrame content', async () => {
    const fetchSpy = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            stack: [
              {
                methodName: 'x',
                file: 'apps/playground/src/x.ts',
                lineNumber: 1,
                column: 1,
              },
            ],
            codeFrame: {
              fileName: 'apps/playground/src/x.ts',
              // ESC [31m red ESC [0m
              content: '[31m  41 |   foo();[0m',
              line: 41,
              column: 3,
            },
          }),
          { status: 200 },
        ),
    );
    const result = await symbolicateFrames([sampleFrame()], {
      origin: 'http://localhost:8081',
      fetch: fetchSpy as typeof globalThis.fetch,
    });
    expect(result.status).toBe('complete');
    if (result.status !== 'complete') return;
    expect(result.codeFrame?.content).toBe('  41 |   foo();');
    expect(result.codeFrame?.line).toBe(41);
    expect(result.codeFrame?.column).toBe(3);
  });

  it('returns "failed" when Metro responds with a non-200 status', async () => {
    const fetchSpy = vi.fn(
      async () => new Response('Server Error', { status: 500 }),
    );
    const result = await symbolicateFrames([sampleFrame()], {
      origin: 'http://localhost:8081',
      fetch: fetchSpy as typeof globalThis.fetch,
    });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.error).toContain('500');
    // Raw frames preserved so the UI can still show what we had.
    expect(result.frames).toHaveLength(1);
  });

  it('returns "failed" with a timeout error when the request exceeds timeoutMs', async () => {
    const fetchSpy = vi.fn(
      (_url: string, init: RequestInit | undefined) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );
    const result = await symbolicateFrames([sampleFrame()], {
      origin: 'http://localhost:8081',
      fetch: fetchSpy as unknown as typeof globalThis.fetch,
      timeoutMs: 10,
    });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.error).toContain('timed out');
  });
});
