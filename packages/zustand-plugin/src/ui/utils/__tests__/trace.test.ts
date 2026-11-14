import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseStack, symbolicateStack } from '../trace';

describe('parseStack', () => {
  it('parses V8 function frames', () => {
    expect(
      parseStack('Error\n    at dispatchAction (http://localhost:8081/index.bundle:123:45)'),
    ).toEqual([
      {
        functionName: 'dispatchAction',
        generatedUrl: 'http://localhost:8081/index.bundle',
        generatedLineNumber: 123,
        generatedColumnNumber: 45,
      },
    ]);
  });

  it('parses JavaScriptCore frames', () => {
    expect(
      parseStack('dispatchAction@http://localhost:8081/index.bundle?platform=ios:123:45'),
    ).toEqual([
      {
        functionName: 'dispatchAction',
        generatedUrl: 'http://localhost:8081/index.bundle?platform=ios',
        generatedLineNumber: 123,
        generatedColumnNumber: 45,
      },
    ]);
  });
});

describe('symbolicateStack', () => {
  const target = globalThis as { window?: unknown };
  const stack = 'Error\n    at addItem (http://localhost:8081/index.bundle:10:5)\n    at native';

  beforeEach(() => {
    target.window = { location: { origin: 'http://localhost:8081' } };
  });
  afterEach(() => {
    delete target.window;
  });

  it('asks the Metro server serving the panel to map bundle frames to sources', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        stack: [{ methodName: 'addItem', file: '/app/src/cart.ts', lineNumber: 24, column: 9 }],
        codeFrame: {
          fileName: '/app/src/cart.ts',
          content: '\u001b[31m> 24 |\u001b[39m set()',
          location: { row: 24, column: 9 },
        },
      }),
    }));

    const trace = await symbolicateStack(stack, fetchImpl as never);

    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:8081/symbolicate', expect.anything());
    expect(trace).toMatchObject({
      status: 'complete',
      frames: [{ functionName: 'addItem', url: '/app/src/cart.ts', lineNumber: 24 }],
      codeFrame: { fileName: '/app/src/cart.ts', line: 24, content: '> 24 | set()' },
    });
  });

  it('falls back to bundle locations when Metro fails', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 }));
    const trace = await symbolicateStack(stack, fetchImpl as never);
    expect(trace).toMatchObject({
      status: 'failed',
      error: 'Metro responded with HTTP 500',
      frames: [{ functionName: 'addItem', generatedLineNumber: 10 }],
    });
  });
});
