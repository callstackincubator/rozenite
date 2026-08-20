import { getChannel } from './channel/factory.js';
import { Channel } from './channel/types.js';
import { getDevToolsMessage } from './message';
import { Subscription } from './types';

type MessageListener = (payload: unknown) => void;

type RequestMessage = {
  requestId: string;
};

type RequestMessageType<TEventMap extends Record<string, unknown>> = {
  [TType in keyof TEventMap]: TEventMap[TType] extends RequestMessage ? TType : never;
}[keyof TEventMap];

export type RozeniteDevToolsRequestOptions<
  TEventMap extends Record<string, unknown>,
  TRequestType extends RequestMessageType<TEventMap>,
  TResponseType extends RequestMessageType<TEventMap>,
  TErrorType extends RequestMessageType<TEventMap> | undefined = undefined,
> = {
  requestType: TRequestType;
  responseType: TResponseType;
  errorType?: TErrorType;
  payload: Omit<TEventMap[TRequestType], 'requestId'>;
  requestId?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export class RozeniteDevToolsRequestAbortedError extends Error {
  constructor(readonly requestId: string) {
    super(`Request "${requestId}" was aborted.`);
    this.name = 'RozeniteDevToolsRequestAbortedError';
  }
}

export class RozeniteDevToolsRequestTimeoutError extends Error {
  constructor(
    readonly requestId: string,
    readonly timeoutMs: number,
  ) {
    super(`Request "${requestId}" timed out after ${timeoutMs}ms.`);
    this.name = 'RozeniteDevToolsRequestTimeoutError';
  }
}

export class RozeniteDevToolsRequestClientClosedError extends Error {
  constructor(readonly requestId: string) {
    super(`Request "${requestId}" was cancelled because the client closed.`);
    this.name = 'RozeniteDevToolsRequestClientClosedError';
  }
}

export class RozeniteDevToolsRequestResponseError<
  TPayload extends RequestMessage = RequestMessage,
> extends Error {
  constructor(readonly payload: TPayload) {
    super(`Request "${payload.requestId}" received an error response.`);
    this.name = 'RozeniteDevToolsRequestResponseError';
  }
}

export type RozeniteDevToolsClient<
  TEventMap extends Record<string, unknown> = Record<string, unknown>,
> = {
  send: <TType extends keyof TEventMap>(type: TType, payload: TEventMap[TType]) => void;
  onMessage: <TType extends keyof TEventMap>(
    type: TType,
    listener: (payload: TEventMap[TType]) => void,
  ) => Subscription;
  close: () => void;
};

export type RozeniteDevToolsRequestClient<
  TEventMap extends Record<string, unknown> = Record<string, unknown>,
> = RozeniteDevToolsClient<TEventMap> & {
  request: <
    TRequestType extends RequestMessageType<TEventMap>,
    TResponseType extends RequestMessageType<TEventMap>,
    TErrorType extends RequestMessageType<TEventMap> | undefined = undefined,
  >(
    options: RozeniteDevToolsRequestOptions<TEventMap, TRequestType, TResponseType, TErrorType>,
  ) => Promise<TEventMap[TResponseType]>;
};

export type RozeniteDevToolsClientOptions = {
  /**
   * Use this `Channel` instead of resolving one via `getChannel()`.
   *
   * This is the injection seam that lets `@rozenite/testing` run both
   * halves of a plugin (panel and device) against each other in-process,
   * over a real `Channel` implementation, without touching the module-scoped
   * channel cache in `./channel/factory.js` — which is shared across every
   * caller in the process and would otherwise make a panel client and a
   * device client in the same Node test process collide onto one channel.
   *
   * Production callers should never need this: leave it unset and a real
   * channel is resolved and cached as before.
   */
  channel?: Channel;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

let requestSequence = 0;

const createRequestId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  requestSequence += 1;
  return `rozenite-${Date.now()}-${requestSequence}`;
};

const createRozeniteDevToolsClient = async <
  TEventMap extends Record<string, unknown> = Record<string, unknown>,
>(
  pluginId: string,
  options: RozeniteDevToolsClientOptions = {},
): Promise<RozeniteDevToolsRequestClient<TEventMap>> => {
  const channel = options.channel ?? (await getChannel());
  const listeners = new Map<string, Set<MessageListener>>();
  const pendingRequests = new Set<() => void>();
  let isClosed = false;

  const handleMessage = async (cdpMessage: unknown) => {
    const message = getDevToolsMessage(cdpMessage);

    if (!message || message.pluginId !== pluginId) {
      return;
    }

    const typeListeners = listeners.get(message.type);

    if (typeListeners != null) {
      typeListeners.forEach((listener) => {
        listener(message.payload);
      });
    }
  };

  const send = <TType extends keyof TEventMap>(type: TType, payload: TEventMap[TType]) => {
    channel.send({
      pluginId,
      type,
      payload,
    });
  };

  const subscription = channel.onMessage(handleMessage);

  const client: RozeniteDevToolsRequestClient<TEventMap> = {
    send,
    onMessage: <TType extends keyof TEventMap>(
      type: TType,
      listener: (payload: TEventMap[TType]) => void,
    ) => {
      const typeListeners = listeners.get(type as string) ?? new Set();
      typeListeners.add(listener as MessageListener);
      listeners.set(type as string, typeListeners);

      return {
        remove: () => {
          typeListeners.delete(listener as MessageListener);

          if (typeListeners.size === 0) {
            listeners.delete(type as string);
          }
        },
      };
    },
    request: (options) => {
      const requestId = options.requestId ?? createRequestId();
      const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

      if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
        return Promise.reject(new RangeError('timeoutMs must be a finite, non-negative number.'));
      }

      if (isClosed) {
        return Promise.reject(new RozeniteDevToolsRequestClientClosedError(requestId));
      }

      if (options.signal?.aborted) {
        return Promise.reject(new RozeniteDevToolsRequestAbortedError(requestId));
      }

      return new Promise((resolve, reject) => {
        let isSettled = false;

        const abort = () => {
          cancel(new RozeniteDevToolsRequestAbortedError(requestId));
        };

        const cleanup = () => {
          responseSubscription.remove();
          errorSubscription?.remove();
          clearTimeout(timeout);
          options.signal?.removeEventListener('abort', abort);
          pendingRequests.delete(closeRequest);
        };

        const settle = (callback: () => void) => {
          if (isSettled) {
            return;
          }

          isSettled = true;
          cleanup();
          callback();
        };

        const cancel = (error: Error) => {
          settle(() => {
            reject(error);
          });
        };
        const closeRequest = () => {
          cancel(new RozeniteDevToolsRequestClientClosedError(requestId));
        };

        const responseSubscription = client.onMessage(options.responseType, (payload) => {
          if ((payload as RequestMessage).requestId !== requestId) {
            return;
          }

          settle(() => {
            resolve(payload);
          });
        });

        const errorSubscription =
          options.errorType != null
            ? client.onMessage(options.errorType, (payload) => {
                if ((payload as RequestMessage).requestId !== requestId) {
                  return;
                }

                settle(() => {
                  reject(new RozeniteDevToolsRequestResponseError(payload as RequestMessage));
                });
              })
            : undefined;

        options.signal?.addEventListener('abort', abort, { once: true });
        pendingRequests.add(closeRequest);
        const timeout = setTimeout(() => {
          cancel(new RozeniteDevToolsRequestTimeoutError(requestId, timeoutMs));
        }, timeoutMs);

        try {
          client.send(options.requestType, {
            ...options.payload,
            requestId,
          } as TEventMap[typeof options.requestType]);
        } catch (error) {
          cancel(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },
    close: () => {
      if (isClosed) {
        return;
      }

      isClosed = true;
      pendingRequests.forEach((closeRequest) => {
        closeRequest();
      });
      listeners.clear();
      subscription.remove();
      channel.close();
    },
  };
  return client;
};

export const getRozeniteDevToolsClient = async <
  TEventMap extends Record<string, unknown> = Record<string, unknown>,
>(
  pluginId: string,
  options: RozeniteDevToolsClientOptions = {},
): Promise<RozeniteDevToolsRequestClient<TEventMap>> => {
  return createRozeniteDevToolsClient<TEventMap>(pluginId, options);
};
