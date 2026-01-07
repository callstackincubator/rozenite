import { describe, it, expect, vi } from 'vitest';
import { createRozeniteRPCBridge } from './rpc';
import type { RozeniteRPCTransport } from './index';

describe('createRozeniteRPCBridge', () => {
  const createMockTransport = () => {
    let listener: (message: unknown) => void = () => {
      // Empty listener to avoid warnings
    };
    
    return {
      send: vi.fn(),
      onMessage: vi.fn((l) => {
        listener = l;
      }),
      // Helper to simulate receiving a message
      emit: (message: unknown) => listener(message),
    };
  };

  type Local = {
    add(a: number, b: number): Promise<number>;
    getError(): Promise<void>;
  };

  type Remote = {
    multiply(a: number, b: number): Promise<number>;
  };

  it('should call remote methods via proxy and receive results', async () => {
    const transport = createMockTransport();
    const localHandlers: Local = {
      add: async (a, b) => a + b,
      getError: async () => {
        throw new Error('Local error');
      },
    };

    const bridge = createRozeniteRPCBridge<Local, Remote>(
      transport as unknown as RozeniteRPCTransport,
      localHandlers
    );

    // Call remote method
    const promise = bridge.multiply(2, 3);

    // Verify request was sent
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonrpc: '2.0',
        method: 'multiply',
        params: [2, 3],
        id: expect.any(String),
      })
    );

    // Simulate response
    const lastCall = transport.send.mock.calls[0][0] as any;
    transport.emit({
      jsonrpc: '2.0',
      id: lastCall.id,
      result: 6,
    });

    const result = await promise;
    expect(result).toBe(6);
  });

  it('should handle incoming requests and send responses', async () => {
    const transport = createMockTransport();
    const localHandlers: Local = {
      add: async (a, b) => a + b,
      getError: async () => {
        throw new Error('Local error');
      },
    };

    createRozeniteRPCBridge<Local, Remote>(
      transport as unknown as RozeniteRPCTransport,
      localHandlers
    );

    // Simulate incoming request
    transport.emit({
      jsonrpc: '2.0',
      id: '123',
      method: 'add',
      params: [10, 20],
    });

    // Wait for promise resolution in handler
    await vi.waitFor(() => {
      expect(transport.send).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: '123',
        result: 30,
      });
    });
  });

  it('should handle errors across the bridge', async () => {
    const transport = createMockTransport();
    const localHandlers: Local = {
      add: async (a, b) => a + b,
      getError: async () => {
        throw new Error('Remote crash');
      },
    };

    const bridge = createRozeniteRPCBridge<Local, Remote>(
      transport as unknown as RozeniteRPCTransport,
      localHandlers
    );

    // Test remote error (received from other side)
    const promise = bridge.multiply(5, 5);
    const lastCall = transport.send.mock.calls[0][0] as any;
    
    transport.emit({
      jsonrpc: '2.0',
      id: lastCall.id,
      error: { message: 'Method failed' },
    });

    await expect(promise).rejects.toThrow('Method failed');

    // Test local error (sent to other side)
    transport.emit({
      jsonrpc: '2.0',
      id: '456',
      method: 'getError',
      params: [],
    });

    await vi.waitFor(() => {
      expect(transport.send).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          id: '456',
          error: expect.objectContaining({
            message: 'Remote crash',
          }),
        })
      );
    });
  });

  it('should ignore non-RPC messages', async () => {
    const transport = createMockTransport();
    const localHandlers = {
      ping: vi.fn(),
    };

    createRozeniteRPCBridge(
      transport as unknown as RozeniteRPCTransport,
      localHandlers
    );

    // Send invalid message
    transport.emit({ type: 'not-rpc', data: {} });
    
    expect(localHandlers.ping).not.toHaveBeenCalled();
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('should timeout if no response is received', async () => {
    const transport = createMockTransport();
    const localHandlers = {};

    vi.useFakeTimers();

    const bridge = createRozeniteRPCBridge<typeof localHandlers, Remote>(
      transport as unknown as RozeniteRPCTransport,
      localHandlers,
      { timeout: 1000 }
    );

    const promise = bridge.multiply(1, 2);

    // Fast-forward time
    vi.advanceTimersByTime(1001);

    await expect(promise).rejects.toThrow('RPC Timeout: Request multiply timed out after 1000ms');

    vi.useRealTimers();
  });
});
