import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRozeniteRpc } from './create-rozenite-rpc.js';
import { isHandlerError, isProtocolError } from './errors.js';
import type { RozeniteHandlerError, RozeniteProtocolError } from './errors.js';
import { ROZENITE_RPC_MESSAGE_TYPE } from './frames.js';
import { InvokeOptions, RozeniteRpc } from './types.js';
import { createFakeClientPair } from './test-utils.js';

// The behavior tests below intentionally use a loose method map — they
// exercise runtime protocol behavior, which doesn't depend on the static
// method-map typing. Compile-time inference (arg count per method, unknown
// method names) is covered separately in `rpc-types.test.ts`.
type AnyMethods = Record<string, (...args: any[]) => any>;

// `AnyMethods` gives every method the same `(...args: any[]) => any)`
// signature, so `InvokeParams` always picks the "params required" branch —
// fine for calls that pass params, but too strict for the zero-arg calls we
// also want to exercise (`method('ping').invoke()`). Route those through
// this untyped helper instead of fighting the type system for a
// runtime-behavior test.
const invokeLoose = (
  rpc: RozeniteRpc<AnyMethods>,
  methodName: string,
  options?: InvokeOptions,
  ...params: unknown[]
): Promise<unknown> =>
  (
    rpc.method(methodName, options) as unknown as {
      invoke: (...a: unknown[]) => Promise<unknown>;
    }
  ).invoke(...params);

const requestFramesOf = (sendMock: {
  mock: { calls: unknown[][] };
}): { id: string; method: string }[] =>
  sendMock.mock.calls
    .filter(([type]) => type === ROZENITE_RPC_MESSAGE_TYPE)
    .map(([, frame]) => frame as { kind: string; id: string; method: string })
    .filter((frame) => frame.kind === 'request');

describe('createRozeniteRpc', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reserves rozenite:rpc as its message type', () => {
    expect(ROZENITE_RPC_MESSAGE_TYPE).toBe('rozenite:rpc');
  });

  it('happy path: resolves with the handler result', async () => {
    const { clientA, clientB } = createFakeClientPair();
    const rpcA = createRozeniteRpc<AnyMethods>(clientA);
    const rpcB = createRozeniteRpc<AnyMethods>(clientB);

    rpcB.handle('getUser', async ({ id }: { id: string }) => ({
      id,
      name: 'Ada',
    }));

    const result = await invokeLoose(rpcA, 'getUser', undefined, { id: '42' });

    expect(result).toEqual({ id: '42', name: 'Ada' });
  });

  it('method("name").invoke() works for zero-arg methods', async () => {
    const { clientA, clientB } = createFakeClientPair();
    const rpcA = createRozeniteRpc<AnyMethods>(clientA);
    const rpcB = createRozeniteRpc<AnyMethods>(clientB);

    rpcB.handle('ping', async () => 'pong');

    await expect(invokeLoose(rpcA, 'ping')).resolves.toBe('pong');
  });

  it('options passed to method() apply to the call, independent of params', async () => {
    const { clientA, clientB } = createFakeClientPair();
    const rpcA = createRozeniteRpc<AnyMethods>(clientA);
    const rpcB = createRozeniteRpc<AnyMethods>(clientB);

    let receivedParams: unknown = 'not-called';
    rpcB.handle('ping', async (params: unknown) => {
      receivedParams = params;
      return 'pong';
    });

    await invokeLoose(rpcA, 'ping', { timeoutMs: 15_000 });

    expect(receivedParams).toBeUndefined();
  });

  it('a handle can be reused across multiple invoke() calls', async () => {
    const { clientA, clientB } = createFakeClientPair();
    const rpcA = createRozeniteRpc<AnyMethods>(clientA);
    const rpcB = createRozeniteRpc<AnyMethods>(clientB);

    rpcB.handle('echo', async (params: unknown) => params);

    const echo = rpcA.method('echo', { timeoutMs: 15_000 });
    await expect(echo.invoke('a')).resolves.toBe('a');
    await expect(echo.invoke('b')).resolves.toBe('b');
  });

  it('rejects with METHOD_NOT_FOUND for an unregistered method', async () => {
    const { clientA, clientB } = createFakeClientPair();
    const rpcA = createRozeniteRpc<AnyMethods>(clientA);
    createRozeniteRpc<AnyMethods>(clientB); // listening, but nothing registered

    const error = (await invokeLoose(rpcA, 'missing').catch(
      (e) => e,
    )) as RozeniteProtocolError;

    expect(isProtocolError(error)).toBe(true);
    expect(error.code).toBe('METHOD_NOT_FOUND');
    expect(error.method).toBe('missing');
  });

  it('ACK_TIMEOUT without retry when nobody is listening', async () => {
    const { clientA } = createFakeClientPair(); // no peer rpc instance at all

    const rpcA = createRozeniteRpc<AnyMethods>(clientA);
    const promise = invokeLoose(rpcA, 'ping', {
      ackTimeoutMs: 1_000,
      retries: 0,
    });
    const errorPromise = promise.catch((e) => e);

    await vi.advanceTimersByTimeAsync(1_100);

    const error = (await errorPromise) as RozeniteProtocolError;
    expect(isProtocolError(error)).toBe(true);
    expect(error.code).toBe('ACK_TIMEOUT');
    expect(requestFramesOf(clientA.send as never)).toHaveLength(1);
  });

  it('ACK_TIMEOUT retries once by default, using a fresh id', async () => {
    const { clientA } = createFakeClientPair();

    const rpcA = createRozeniteRpc<AnyMethods>(clientA);
    const promise = invokeLoose(rpcA, 'ping', { ackTimeoutMs: 1_000 });
    const errorPromise = promise.catch((e) => e);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(requestFramesOf(clientA.send as never)).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(1_000);
    const error = (await errorPromise) as RozeniteProtocolError;
    expect(error.code).toBe('ACK_TIMEOUT');

    const frames = requestFramesOf(clientA.send as never);
    expect(frames).toHaveLength(2);
    expect(frames[0].id).not.toBe(frames[1].id);
  });

  it('STALLED after missed heartbeats', async () => {
    const { clientA, clientB, dropBtoA } = createFakeClientPair();
    const rpcA = createRozeniteRpc<AnyMethods>(clientA);
    const rpcB = createRozeniteRpc<AnyMethods>(clientB);

    rpcB.handle('slow', () => new Promise(() => {})); // never resolves

    const promise = invokeLoose(rpcA, 'slow', {
      staleTimeoutMs: 3_000,
      heartbeatMs: 1_000,
      timeoutMs: 60_000,
    });
    const errorPromise = promise.catch((e) => e);

    // Let the ack through, then go dark.
    await vi.advanceTimersByTimeAsync(0);
    dropBtoA(true);

    await vi.advanceTimersByTimeAsync(3_100);

    const error = (await errorPromise) as RozeniteProtocolError;
    expect(isProtocolError(error)).toBe(true);
    expect(error.code).toBe('STALLED');
  });

  it('TIMEOUT on a never-resolving handler that keeps heartbeating', async () => {
    const { clientA, clientB } = createFakeClientPair();
    const rpcA = createRozeniteRpc<AnyMethods>(clientA);
    const rpcB = createRozeniteRpc<AnyMethods>(clientB);

    rpcB.handle('never', () => new Promise(() => {}));

    const promise = invokeLoose(rpcA, 'never', {
      timeoutMs: 5_000,
      heartbeatMs: 1_000,
      staleTimeoutMs: 3_000,
    });
    const errorPromise = promise.catch((e) => e);

    // Heartbeats every 1s keep staleTimeoutMs (3s) from tripping, but the
    // absolute cap (5s) still fires.
    await vi.advanceTimersByTimeAsync(5_100);

    const error = (await errorPromise) as RozeniteProtocolError;
    expect(isProtocolError(error)).toBe(true);
    expect(error.code).toBe('TIMEOUT');
  });

  it('a slow-but-heartbeating handler does not trip staleTimeoutMs', async () => {
    const { clientA, clientB } = createFakeClientPair();
    const rpcA = createRozeniteRpc<AnyMethods>(clientA);
    const rpcB = createRozeniteRpc<AnyMethods>(clientB);

    let resolveHandler: (value: string) => void = () => {};
    rpcB.handle(
      'slow',
      () =>
        new Promise<string>((resolve) => {
          resolveHandler = resolve;
        }),
    );

    const promise = invokeLoose(rpcA, 'slow', {
      staleTimeoutMs: 3_000,
      heartbeatMs: 1_000,
      timeoutMs: 60_000,
    });

    // Elapse well past staleTimeoutMs, in increments, while heartbeats keep
    // arriving and resetting the stale timer.
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(1_000);
    }

    resolveHandler('done');
    await vi.advanceTimersByTimeAsync(0);

    await expect(promise).resolves.toBe('done');
  });

  it('caller AbortSignal cancels the call and aborts ctx.signal', async () => {
    const { clientA, clientB } = createFakeClientPair();
    const rpcA = createRozeniteRpc<AnyMethods>(clientA);
    const rpcB = createRozeniteRpc<AnyMethods>(clientB);

    let handlerAborted = false;
    rpcB.handle('longRunning', (_params: unknown, ctx) => {
      ctx.signal.addEventListener('abort', () => {
        handlerAborted = true;
      });
      return new Promise(() => {});
    });

    const controller = new AbortController();
    const promise = invokeLoose(rpcA, 'longRunning', {
      signal: controller.signal,
    });
    const errorPromise = promise.catch((e) => e);

    await vi.advanceTimersByTimeAsync(0); // flush request + ack

    controller.abort();
    await vi.advanceTimersByTimeAsync(0); // flush cancel frame

    const error = (await errorPromise) as RozeniteProtocolError;
    expect(isProtocolError(error)).toBe(true);
    expect(error.code).toBe('CANCELLED');
    expect(handlerAborted).toBe(true);
  });

  it('drops a late result that arrives after cancellation', async () => {
    const { clientA, clientB } = createFakeClientPair();
    const rpcA = createRozeniteRpc<AnyMethods>(clientA);
    const rpcB = createRozeniteRpc<AnyMethods>(clientB);

    let resolveHandler: (value: string) => void = () => {};
    rpcB.handle(
      'op',
      () =>
        new Promise<string>((resolve) => {
          resolveHandler = resolve;
        }),
    );

    const controller = new AbortController();
    const promise = invokeLoose(rpcA, 'op', { signal: controller.signal });
    const errorPromise = promise.catch((e) => e);

    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    const error = (await errorPromise) as RozeniteProtocolError;
    expect(error.code).toBe('CANCELLED');

    const sendCallsBefore = (
      clientB.send as unknown as { mock: { calls: unknown[] } }
    ).mock.calls.length;

    // The handler settles well after the caller gave up. It must be
    // silently discarded — no frame is sent for it, and nothing throws.
    resolveHandler('too late');
    await vi.advanceTimersByTimeAsync(0);

    const sendCallsAfter = (
      clientB.send as unknown as { mock: { calls: unknown[] } }
    ).mock.calls.length;
    expect(sendCallsAfter).toBe(sendCallsBefore);
  });

  it('propagates the handler error name and message', async () => {
    const { clientA, clientB } = createFakeClientPair();
    const rpcA = createRozeniteRpc<AnyMethods>(clientA);
    const rpcB = createRozeniteRpc<AnyMethods>(clientB);

    rpcB.handle('boom', () => {
      throw new TypeError('bad input');
    });

    const error = (await invokeLoose(rpcA, 'boom').catch(
      (e) => e,
    )) as RozeniteHandlerError;

    expect(isHandlerError(error)).toBe(true);
    expect(error.remote.name).toBe('TypeError');
    expect(error.remote.message).toBe('bad input');
    expect(error.message).toBe('boom failed: bad input');
    expect(error.method).toBe('boom');
  });

  it('attaches remote.stack only in development', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    try {
      const { clientA, clientB } = createFakeClientPair();
      const rpcA = createRozeniteRpc<AnyMethods>(clientA);
      const rpcB = createRozeniteRpc<AnyMethods>(clientB);
      rpcB.handle('boom', () => {
        throw new Error('dev stack check');
      });

      process.env.NODE_ENV = 'development';
      const devError = (await invokeLoose(rpcA, 'boom').catch(
        (e) => e,
      )) as RozeniteHandlerError;
      expect(devError.remote.stack).toBeTypeOf('string');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('omits remote.stack in production', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    try {
      const { clientA, clientB } = createFakeClientPair();
      const rpcA = createRozeniteRpc<AnyMethods>(clientA);
      const rpcB = createRozeniteRpc<AnyMethods>(clientB);
      rpcB.handle('boom', () => {
        throw new Error('prod stack check');
      });

      process.env.NODE_ENV = 'production';
      const prodError = (await invokeLoose(rpcA, 'boom').catch(
        (e) => e,
      )) as RozeniteHandlerError;
      expect(prodError.remote.stack).toBeUndefined();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('turns a non-cloneable result into SERIALIZATION_ERROR', async () => {
    const { clientA, clientB } = createFakeClientPair();
    const rpcA = createRozeniteRpc<AnyMethods>(clientA);
    const rpcB = createRozeniteRpc<AnyMethods>(clientB);

    rpcB.handle('badResult', () => ({ fn: () => 'not cloneable' }));

    const error = (await invokeLoose(rpcA, 'badResult').catch(
      (e) => e,
    )) as RozeniteProtocolError;

    expect(isProtocolError(error)).toBe(true);
    expect(error.code).toBe('SERIALIZATION_ERROR');
  });

  it('close() rejects in-flight calls with CLIENT_CLOSED', async () => {
    const { clientA, clientB } = createFakeClientPair();
    const rpcA = createRozeniteRpc<AnyMethods>(clientA);
    const rpcB = createRozeniteRpc<AnyMethods>(clientB);

    rpcB.handle('op', () => new Promise(() => {}));

    const promise = invokeLoose(rpcA, 'op');
    const errorPromise = promise.catch((e) => e);
    await vi.advanceTimersByTimeAsync(0); // flush ack

    rpcA.close();

    const error = (await errorPromise) as RozeniteProtocolError;
    expect(isProtocolError(error)).toBe(true);
    expect(error.code).toBe('CLIENT_CLOSED');
  });

  it('throws when registering a second handler for the same method', () => {
    const { clientB } = createFakeClientPair();
    const rpcB = createRozeniteRpc<AnyMethods>(clientB);

    rpcB.handle('x', () => 'ok');

    expect(() => rpcB.handle('x', () => 'ok2')).toThrow();
  });
});
