import { describe, expect, it, vi } from 'vitest';
import {
  symbolicateInitiator,
  symbolicateStackTraceWithMetro,
} from '../symbolication';
import type { Initiator } from '../../../shared/client';

describe('symbolication', () => {
  it('selects the source frame matching the Metro code frame', async () => {
    const initiator: Initiator = {
      type: 'script',
      generatedUrl: 'http://localhost:8081/index.bundle',
      generatedLineNumber: 1,
      generatedColumnNumber: 100,
      symbolicationStatus: 'pending',
      stack: [
        {
          functionName: 'fetch',
          generatedUrl: 'http://localhost:8081/index.bundle',
          generatedLineNumber: 1,
          generatedColumnNumber: 100,
        },
        {
          functionName: 'loadUsers',
          generatedUrl: 'http://localhost:8081/index.bundle',
          generatedLineNumber: 1,
          generatedColumnNumber: 200,
        },
      ],
    };

    const symbolicatedInitiator = await symbolicateInitiator(
      initiator,
      vi.fn().mockResolvedValue({
        stack: [
          {
            methodName: 'fetch',
            file: 'node_modules/react-native/Libraries/Network/fetch.js',
            lineNumber: 10,
            column: 2,
          },
          {
            methodName: 'loadUsers',
            file: 'apps/playground/src/app/api.ts',
            lineNumber: 30,
            column: 6,
          },
        ],
        codeFrame: {
          content: '\u001b[90m 30 |\u001b[39m loadUsers();\u001b[0m',
          fileName: 'apps/playground/src/app/api.ts',
          location: {
            row: 30,
            column: 6,
          },
        },
      }),
    );

    expect(symbolicatedInitiator).toMatchObject({
      type: 'script',
      functionName: 'loadUsers',
      url: 'apps/playground/src/app/api.ts',
      lineNumber: 30,
      columnNumber: 6,
      symbolicationStatus: 'complete',
      codeFrame: {
        content: ' 30 | loadUsers();',
        fileName: 'apps/playground/src/app/api.ts',
      },
    });
  });

  it('falls back to the first non-collapsed source frame', async () => {
    const initiator: Initiator = {
      type: 'script',
      generatedUrl: 'http://localhost:8081/index.bundle',
      generatedLineNumber: 1,
      generatedColumnNumber: 100,
      symbolicationStatus: 'pending',
      stack: [
        {
          functionName: 'send',
          generatedUrl: 'http://localhost:8081/index.bundle',
          generatedLineNumber: 1,
          generatedColumnNumber: 100,
        },
        {
          functionName: 'loadUsers',
          generatedUrl: 'http://localhost:8081/index.bundle',
          generatedLineNumber: 1,
          generatedColumnNumber: 200,
        },
      ],
    };

    const symbolicatedInitiator = await symbolicateInitiator(
      initiator,
      vi.fn().mockResolvedValue({
        stack: [
          {
            methodName: 'send',
            file: 'packages/network-activity-plugin/src/http.ts',
            lineNumber: 10,
            column: 2,
            collapse: true,
          },
          {
            methodName: 'loadUsers',
            file: 'apps/playground/src/app/api.ts',
            lineNumber: 30,
            column: 6,
          },
        ],
      }),
    );

    expect(symbolicatedInitiator).toMatchObject({
      type: 'script',
      functionName: 'loadUsers',
      url: 'apps/playground/src/app/api.ts',
      lineNumber: 30,
      columnNumber: 6,
      symbolicationStatus: 'complete',
      codeFrame: null,
    });
  });

  it('reports symbolication failures on the initiator', async () => {
    const initiator: Initiator = {
      type: 'script',
      symbolicationStatus: 'pending',
      stack: [
        {
          generatedUrl: 'http://localhost:8081/index.bundle',
          generatedLineNumber: 1,
          generatedColumnNumber: 100,
        },
      ],
    };

    const symbolicatedInitiator = await symbolicateInitiator(
      initiator,
      vi.fn().mockRejectedValue(new Error('Metro is unavailable')),
    );

    expect(symbolicatedInitiator).toMatchObject({
      symbolicationStatus: 'failed',
      symbolicationError: 'Metro is unavailable',
    });
  });

  it('posts stack frames to the Metro symbolication endpoint from the panel origin', async () => {
    const originalFetch = globalThis.fetch;
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, 'window', {
      value: {
        location: {
          origin: 'http://localhost:8081',
        },
      },
      configurable: true,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        stack: [],
      }),
    } as Partial<Response> as Response);

    try {
      await symbolicateStackTraceWithMetro([
        {
          methodName: 'loadUsers',
          file: 'http://localhost:8081/index.bundle',
          lineNumber: 1,
          column: 100,
        },
      ]);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:8081/symbolicate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            stack: [
              {
                methodName: 'loadUsers',
                file: 'http://localhost:8081/index.bundle',
                lineNumber: 1,
                column: 100,
              },
            ],
          }),
        }),
      );
    } finally {
      globalThis.fetch = originalFetch;
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        configurable: true,
      });
    }
  });
});
