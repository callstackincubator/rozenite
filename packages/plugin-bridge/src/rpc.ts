import { Subscription } from './types';

export type Transport = {
  send(message: unknown): void;
  onMessage(listener: (message: unknown) => void): Subscription | void;
};

export type RPCRequest = {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params: unknown[];
};

export type RPCResponseSuccess = {
  jsonrpc: '2.0';
  id: string;
  result: unknown;
};

export type RPCResponseError = {
  jsonrpc: '2.0';
  id: string;
  error: {
    message: string;
    code?: number;
    data?: unknown;
  };
};

export type RPCResponse = RPCResponseSuccess | RPCResponseError;

export type RPCBridgeOptions = {
  /**
   * Timeout in milliseconds for RPC requests.
   * If a response is not received within this time, the promise will be rejected.
   * Set to 0 to disable timeout.
   * @default 60000 (60 seconds)
   */
  timeout?: number;
};

type PendingPromise = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

// Error serialization helper
const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message,
      data: {
        stack: error.stack,
        name: error.name,
        // Copy other properties
        ...Object.getOwnPropertyNames(error).reduce((acc, key) => {
          acc[key] = (error as any)[key];
          return acc;
        }, {} as Record<string, unknown>),
      },
    };
  }
  return {
    message: String(error),
  };
};

// Simple ID generator
const generateId = (): string => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

const isRPCRequest = (message: unknown): message is RPCRequest => {
  const msg = message as any;
  return (
    typeof msg === 'object' &&
    msg !== null &&
    msg.jsonrpc === '2.0' &&
    typeof msg.method === 'string' &&
    typeof msg.id === 'string' &&
    Array.isArray(msg.params)
  );
};

const isRPCResponse = (message: unknown): message is RPCResponse => {
  const msg = message as any;
  return (
    typeof msg === 'object' &&
    msg !== null &&
    msg.jsonrpc === '2.0' &&
    typeof msg.id === 'string' &&
    ('result' in msg || 'error' in msg)
  );
};

/**
 * Creates a Symmetrical Bi-Directional RPC Bridge.
 *
 * @param transport - The transport layer to send/receive messages.
 * @param localHandlers - The implementation of the local methods exposed to the other side.
 * @param options - Configuration options.
 * @returns A Proxy object representing the remote interface.
 */
export const createRozeniteRPCBridge = <
  LocalHandlers extends object,
  RemoteInterface extends object
>(
  transport: Transport,
  localHandlers: LocalHandlers,
  options?: RPCBridgeOptions
): RemoteInterface => {
  const pendingPromises = new Map<string, PendingPromise>();
  const timeoutMs = options?.timeout ?? 60000;

  // Message Handler
  transport.onMessage((message: unknown) => {
    if (isRPCRequest(message)) {
      // It's a request: Execute local handler
      const { id, method, params } = message;
      const handler = (localHandlers as any)[method];

      if (typeof handler === 'function') {
        try {
          const result = handler(...params);
          // Handle sync and async results
          Promise.resolve(result)
            .then((res) => {
              const response: RPCResponseSuccess = {
                jsonrpc: '2.0',
                id,
                result: res,
              };
              transport.send(response);
            })
            .catch((err) => {
              const response: RPCResponseError = {
                jsonrpc: '2.0',
                id,
                error: serializeError(err),
              };
              transport.send(response);
            });
        } catch (err) {
          const response: RPCResponseError = {
            jsonrpc: '2.0',
            id,
            error: serializeError(err),
          };
          transport.send(response);
        }
      } else {
        // Method not found
        const response: RPCResponseError = {
          jsonrpc: '2.0',
          id,
          error: { message: `Method ${method} not found` },
        };
        transport.send(response);
      }
    } else if (isRPCResponse(message)) {
      // It's a response: Resolve/Reject pending promise
      const { id } = message;
      const pending = pendingPromises.get(id);
      if (pending) {
        pendingPromises.delete(id);
        if ('error' in message && message.error) {
          // Reconstruct error
          const errData = (message as RPCResponseError).error;
          const error = new Error(errData.message);
          if (errData.data && typeof errData.data === 'object') {
            Object.assign(error, errData.data);
          }
          pending.reject(error);
        } else {
          pending.resolve((message as RPCResponseSuccess).result);
        }
      }
    }
    // Ignore other messages (opt-in approach)
  });

  // Proxy Mechanism
  return new Proxy({} as RemoteInterface, {
    get: (target, prop) => {
      if (typeof prop === 'string') {
        // Return a function that sends the RPC request
        return (...args: unknown[]) => {
          return new Promise((resolve, reject) => {
            const id = generateId();

            let timer: ReturnType<typeof setTimeout> | undefined;

            if (timeoutMs > 0) {
              timer = setTimeout(() => {
                if (pendingPromises.has(id)) {
                  pendingPromises.delete(id);
                  reject(
                    new Error(
                      `RPC Timeout: Request ${prop} timed out after ${timeoutMs}ms`
                    )
                  );
                }
              }, timeoutMs);
            }

            pendingPromises.set(id, {
              resolve: (val) => {
                if (timer) clearTimeout(timer);
                resolve(val);
              },
              reject: (err) => {
                if (timer) clearTimeout(timer);
                reject(err);
              },
            });

            const request: RPCRequest = {
              jsonrpc: '2.0',
              id,
              method: prop,
              params: args,
            };

            transport.send(request);
          });
        };
      }
      return Reflect.get(target, prop);
    },
  });
};
