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

type PendingPromise = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

// Error serialization helper
function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      data: { 
        stack: error.stack, 
        name: error.name,
        // Copy other properties
        ...Object.getOwnPropertyNames(error).reduce((acc, key) => {
            // @ts-ignore
            acc[key] = error[key];
            return acc;
        }, {} as Record<string, unknown>)
      },
    };
  }
  return {
    message: String(error),
  };
}

// Simple ID generator
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function isRPCRequest(message: any): message is RPCRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    message.jsonrpc === '2.0' &&
    typeof message.method === 'string' &&
    typeof message.id === 'string' &&
    Array.isArray(message.params)
  );
}

function isRPCResponse(message: any): message is RPCResponse {
  return (
    typeof message === 'object' &&
    message !== null &&
    message.jsonrpc === '2.0' &&
    typeof message.id === 'string' &&
    ('result' in message || 'error' in message)
  );
}

/**
 * Creates a Symmetrical Bi-Directional RPC Bridge.
 * 
 * @param transport - The transport layer to send/receive messages.
 * @param localHandlers - The implementation of the local methods exposed to the other side.
 * @returns A Proxy object representing the remote interface.
 */
export function createRozeniteRPCBridge<LocalHandlers extends object, RemoteInterface extends object>(
  transport: Transport,
  localHandlers: LocalHandlers
): RemoteInterface {
  const pendingPromises = new Map<string, PendingPromise>();

  // Message Handler
  transport.onMessage((message: unknown) => {
    if (isRPCRequest(message)) {
      // It's a request: Execute local handler
      const { id, method, params } = message;
      // @ts-ignore
      const handler = localHandlers[method];

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
            pendingPromises.set(id, { resolve, reject });

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
}
