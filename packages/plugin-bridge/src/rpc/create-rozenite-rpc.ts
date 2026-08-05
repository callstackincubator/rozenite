import { RozeniteDevToolsClient } from '../client.js';
import { Subscription } from '../types.js';
import { isDev } from './dev.js';
import { RozeniteHandlerError, RozeniteProtocolError } from './errors.js';
import {
  AckFrame,
  CancelFrame,
  ErrorFrame,
  HeartbeatFrame,
  RequestFrame,
  ResultFrame,
  ROZENITE_RPC_MESSAGE_TYPE,
  RpcFrame,
} from './frames.js';
import { isCloneable } from './serialization.js';
import { InvokeOptions, RozeniteRpc, RpcContext, RpcMethods } from './types.js';

const DEFAULT_ACK_TIMEOUT_MS = 5_000;
const DEFAULT_HEARTBEAT_MS = 2_000;
const DEFAULT_STALE_TIMEOUT_MS = 6_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 1;

// The client that carries RPC frames. RPC only needs `send`/`onMessage` for
// a single reserved message type plus `close`, but consumers pass in a
// `RozeniteDevToolsClient<TEventMap>` scoped to their own plugin event map
// (which doesn't — and shouldn't — know about `'rozenite:rpc'`). We accept
// `any` here at the boundary and narrow internally, rather than fighting
// generic variance on a type the caller doesn't otherwise care about.
type RpcTransport = RozeniteDevToolsClient<any>;

type PendingCall = {
  method: string;
  onAck: () => void;
  onHeartbeat: (frame: HeartbeatFrame) => void;
  onResult: (frame: ResultFrame) => void;
  onError: (frame: ErrorFrame) => void;
};

type ActiveHandlerCall = {
  controller: AbortController;
  interval: ReturnType<typeof setInterval> | null;
  settled: boolean;
  discarded: boolean;
};

type NormalizedError = {
  name: string;
  message: string;
  stack?: string;
  data?: unknown;
};

const normalizeThrown = (thrown: unknown): NormalizedError => {
  if (thrown instanceof Error) {
    const data =
      'data' in thrown
        ? (thrown as unknown as { data?: unknown }).data
        : undefined;
    return {
      name: thrown.name,
      message: thrown.message,
      stack: isDev() ? thrown.stack : undefined,
      data,
    };
  }

  return {
    name: 'Error',
    message: String(thrown),
    data: thrown,
  };
};

const buildErrorFromFrame = (
  method: string,
  frame: ErrorFrame,
): RozeniteProtocolError | RozeniteHandlerError => {
  if (frame.source === 'protocol') {
    return new RozeniteProtocolError(method, frame.code, frame.message);
  }

  return new RozeniteHandlerError(method, {
    name: frame.name,
    message: frame.message,
    stack: frame.stack,
    data: frame.data,
  });
};

/**
 * Creates a symmetric RPC layer on top of an existing
 * `RozeniteDevToolsClient`. Both peers (device and panel) can register
 * handlers and invoke methods on each other.
 *
 * Reserves the message type `'rozenite:rpc'` on `client` — a plugin's own
 * event map must not use that type.
 */
export const createRozeniteRpc = <M extends RpcMethods>(
  client: RpcTransport,
): RozeniteRpc<M> => {
  const clientPrefix = Math.random().toString(36).slice(2, 10);
  let counter = 0;
  const nextId = () => `${clientPrefix}:${counter++}`;

  const handlers = new Map<
    string,
    (params: unknown, ctx: RpcContext) => unknown
  >();
  const pending = new Map<string, PendingCall>();
  const activeCalls = new Map<string, ActiveHandlerCall>();
  let closed = false;

  const send = (frame: RpcFrame): void => {
    client.send(ROZENITE_RPC_MESSAGE_TYPE, frame);
  };

  // --- Receiver side (handling incoming `request`/`cancel` frames) ---

  const settleHandlerCall = (id: string, frame: ErrorFrame | ResultFrame) => {
    const call = activeCalls.get(id);
    if (!call || call.settled || call.discarded) {
      return;
    }
    call.settled = true;
    if (call.interval != null) {
      clearInterval(call.interval);
      call.interval = null;
    }
    activeCalls.delete(id);
    send(frame);
  };

  const handleRequest = (frame: RequestFrame) => {
    // Ack synchronously, before invoking the handler.
    send({ kind: 'ack', id: frame.id });

    const handler = handlers.get(frame.method);
    if (!handler) {
      send({
        kind: 'error',
        id: frame.id,
        source: 'protocol',
        code: 'METHOD_NOT_FOUND',
        message: `No handler registered for method "${frame.method}".`,
      });
      return;
    }

    const controller = new AbortController();
    const call: ActiveHandlerCall = {
      controller,
      interval: null,
      settled: false,
      discarded: false,
    };
    activeCalls.set(frame.id, call);

    const ctx: RpcContext = {
      signal: controller.signal,
    };

    call.interval = setInterval(() => {
      const heartbeat: HeartbeatFrame = { kind: 'heartbeat', id: frame.id };
      send(heartbeat);
    }, frame.heartbeatMs);

    Promise.resolve()
      .then(() => handler(frame.params, ctx))
      .then(
        (value) => {
          if (!isCloneable(value)) {
            settleHandlerCall(frame.id, {
              kind: 'error',
              id: frame.id,
              source: 'protocol',
              code: 'SERIALIZATION_ERROR',
              message: `Result of "${frame.method}" is not structured-cloneable.`,
            });
            return;
          }
          settleHandlerCall(frame.id, { kind: 'result', id: frame.id, value });
        },
        (thrown) => {
          const normalized = normalizeThrown(thrown);
          if (normalized.data !== undefined && !isCloneable(normalized.data)) {
            settleHandlerCall(frame.id, {
              kind: 'error',
              id: frame.id,
              source: 'protocol',
              code: 'SERIALIZATION_ERROR',
              message: `Error data thrown by "${frame.method}" is not structured-cloneable.`,
            });
            return;
          }
          settleHandlerCall(frame.id, {
            kind: 'error',
            id: frame.id,
            source: 'handler',
            name: normalized.name,
            message: normalized.message,
            stack: normalized.stack,
            data: normalized.data,
          });
        },
      );
  };

  const handleCancel = (frame: CancelFrame) => {
    const call = activeCalls.get(frame.id);
    if (!call) {
      return;
    }
    call.discarded = true;
    if (call.interval != null) {
      clearInterval(call.interval);
      call.interval = null;
    }
    activeCalls.delete(frame.id);
    call.controller.abort();
  };

  // --- Caller side (handling incoming `ack`/`heartbeat`/`result`/`error`) ---

  const handleAck = (frame: AckFrame) => pending.get(frame.id)?.onAck();
  const handleHeartbeat = (frame: HeartbeatFrame) =>
    pending.get(frame.id)?.onHeartbeat(frame);
  const handleResult = (frame: ResultFrame) =>
    pending.get(frame.id)?.onResult(frame);
  const handleError = (frame: ErrorFrame) =>
    pending.get(frame.id)?.onError(frame);

  const handleFrame = (frame: RpcFrame) => {
    switch (frame.kind) {
      case 'request':
        return handleRequest(frame);
      case 'ack':
        return handleAck(frame);
      case 'heartbeat':
        return handleHeartbeat(frame);
      case 'result':
        return handleResult(frame);
      case 'error':
        return handleError(frame);
      case 'cancel':
        return handleCancel(frame);
    }
  };

  const subscription: Subscription = client.onMessage(
    ROZENITE_RPC_MESSAGE_TYPE,
    (payload: unknown) => handleFrame(payload as RpcFrame),
  );

  const performInvoke = (
    method: string,
    params: unknown,
    options: InvokeOptions,
  ): Promise<unknown> => {
    const ackTimeoutMs = options.ackTimeoutMs ?? DEFAULT_ACK_TIMEOUT_MS;
    const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
    const staleTimeoutMs = options.staleTimeoutMs ?? DEFAULT_STALE_TIMEOUT_MS;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const retries = options.retries ?? DEFAULT_RETRIES;
    const { signal } = options;

    return new Promise<unknown>((resolve, reject) => {
      if (closed) {
        reject(
          new RozeniteProtocolError(
            method,
            'CLIENT_CLOSED',
            `Cannot invoke "${method}": the RPC client is closed.`,
          ),
        );
        return;
      }

      if (signal?.aborted) {
        reject(
          new RozeniteProtocolError(
            method,
            'CANCELLED',
            `"${method}" was cancelled before it was sent.`,
          ),
        );
        return;
      }

      let settled = false;
      let currentId: string | null = null;

      const finish = (fn: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
        fn();
      };

      const onAbort = () => {
        if (currentId != null) {
          send({ kind: 'cancel', id: currentId });
        }
        cleanupAttempt();
        finish(() =>
          reject(
            new RozeniteProtocolError(
              method,
              'CANCELLED',
              `"${method}" was cancelled.`,
            ),
          ),
        );
      };

      if (signal) {
        signal.addEventListener('abort', onAbort);
      }

      let cleanupAttempt = (): void => {};

      const attempt = (retriesLeft: number) => {
        const id = nextId();
        currentId = id;

        let ackTimer: ReturnType<typeof setTimeout> | null = null;
        let staleTimer: ReturnType<typeof setTimeout> | null = null;
        let totalTimer: ReturnType<typeof setTimeout> | null = null;

        cleanupAttempt = () => {
          if (ackTimer != null) clearTimeout(ackTimer);
          if (staleTimer != null) clearTimeout(staleTimer);
          if (totalTimer != null) clearTimeout(totalTimer);
          pending.delete(id);
        };

        const rearmStale = () => {
          if (staleTimer != null) {
            clearTimeout(staleTimer);
            staleTimer = null;
          }
          if (staleTimeoutMs === Infinity) {
            return;
          }
          staleTimer = setTimeout(() => {
            send({ kind: 'cancel', id });
            cleanupAttempt();
            finish(() =>
              reject(
                new RozeniteProtocolError(
                  method,
                  'STALLED',
                  `"${method}" stopped responding (no ack/heartbeat within ${staleTimeoutMs}ms).`,
                ),
              ),
            );
          }, staleTimeoutMs);
        };

        if (timeoutMs !== Infinity) {
          totalTimer = setTimeout(() => {
            send({ kind: 'cancel', id });
            cleanupAttempt();
            finish(() =>
              reject(
                new RozeniteProtocolError(
                  method,
                  'TIMEOUT',
                  `"${method}" did not settle within ${timeoutMs}ms.`,
                ),
              ),
            );
          }, timeoutMs);
        }

        ackTimer = setTimeout(() => {
          pending.delete(id);
          if (totalTimer != null) {
            clearTimeout(totalTimer);
            totalTimer = null;
          }
          if (retriesLeft > 0) {
            attempt(retriesLeft - 1);
            return;
          }
          finish(() =>
            reject(
              new RozeniteProtocolError(
                method,
                'ACK_TIMEOUT',
                `"${method}" was not acknowledged within ${ackTimeoutMs}ms.`,
              ),
            ),
          );
        }, ackTimeoutMs);

        pending.set(id, {
          method,
          onAck: () => {
            if (ackTimer != null) {
              clearTimeout(ackTimer);
              ackTimer = null;
            }
            rearmStale();
          },
          onHeartbeat: () => {
            rearmStale();
          },
          onResult: (frame) => {
            cleanupAttempt();
            finish(() => resolve(frame.value));
          },
          onError: (frame) => {
            cleanupAttempt();
            finish(() => reject(buildErrorFromFrame(method, frame)));
          },
        });

        send({ kind: 'request', id, method, params, heartbeatMs });
      };

      attempt(retries);
    });
  };

  const method = (methodName: string, options: InvokeOptions = {}) => ({
    invoke: (...params: unknown[]): Promise<unknown> =>
      performInvoke(methodName, params[0], options),
  });

  const handle = (
    method: string,
    handler: (params: unknown, ctx: RpcContext) => unknown,
  ): Subscription => {
    if (handlers.has(method)) {
      throw new Error(
        `A handler for method "${method}" is already registered.`,
      );
    }
    handlers.set(method, handler);

    return {
      remove: () => {
        handlers.delete(method);
      },
    };
  };

  const close = (): void => {
    if (closed) {
      return;
    }
    closed = true;

    subscription.remove();
    handlers.clear();

    for (const [id, call] of pending) {
      call.onError({
        kind: 'error',
        id,
        source: 'protocol',
        code: 'CLIENT_CLOSED',
        message: `Cannot complete "${call.method}": the RPC client is closed.`,
      });
    }
    pending.clear();

    for (const call of activeCalls.values()) {
      if (call.interval != null) {
        clearInterval(call.interval);
      }
      call.controller.abort();
    }
    activeCalls.clear();
  };

  return {
    method: method as RozeniteRpc<M>['method'],
    handle: handle as RozeniteRpc<M>['handle'],
    close,
  };
};
