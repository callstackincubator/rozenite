import { describe, expect, it } from 'vitest';
import { mapToolCallError, isLocalRequest } from '../mcp/http-router.js';

describe('mcp http router helpers', () => {
  it('maps tool-not-found errors to E_TOOL_NOT_FOUND', () => {
    const mapped = mapToolCallError(new Error('Tool "app.unknown" not found'));
    expect(mapped).toEqual({
      status: 404,
      code: 'E_TOOL_NOT_FOUND',
    });
  });

  it('maps timeout errors to E_TOOL_TIMEOUT', () => {
    const mapped = mapToolCallError(new Error('Tool call timeout'));
    expect(mapped).toEqual({
      status: 504,
      code: 'E_TOOL_TIMEOUT',
    });
  });

  it('maps missing devtools connection to E_DEVICE_DISCONNECTED', () => {
    const mapped = mapToolCallError(
      new Error('there is no active DevTools connection to that device'),
    );
    expect(mapped).toEqual({
      status: 409,
      code: 'E_DEVICE_DISCONNECTED',
    });
  });

  it('accepts local requests', () => {
    const result = isLocalRequest({
      headers: {
        host: 'localhost:8081',
      },
      socket: {
        remoteAddress: '127.0.0.1',
      },
    } as any);

    expect(result).toBe(true);
  });

  it('rejects non-local requests', () => {
    const result = isLocalRequest({
      headers: {
        host: 'example.com',
      },
      socket: {
        remoteAddress: '192.168.1.10',
      },
    } as any);

    expect(result).toBe(false);
  });
});
