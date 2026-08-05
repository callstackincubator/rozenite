export type ProtocolErrorCode =
  | 'ACK_TIMEOUT'
  | 'STALLED'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'METHOD_NOT_FOUND'
  | 'SERIALIZATION_ERROR'
  | 'CLIENT_CLOSED';

export type RemoteErrorInfo = {
  name: string;
  message: string;
  /** Only ever populated in development builds — see `./dev.ts`. */
  stack?: string;
  /** Handler-supplied. Must be structured-cloneable. */
  data?: unknown;
};

/**
 * A failure of the RPC transport/protocol itself — the handler provably
 * never ran, or its result/error could not be delivered. Carries no
 * payload and no remote stack, because the failure isn't in user code.
 */
export class RozeniteProtocolError extends Error {
  readonly kind = 'protocol' as const;
  readonly method: string;
  readonly code: ProtocolErrorCode;

  constructor(method: string, code: ProtocolErrorCode, message: string) {
    super(message);
    this.name = 'RozeniteProtocolError';
    this.method = method;
    this.code = code;
  }
}

/**
 * The remote handler ran and threw. `message` and `this.stack` describe the
 * *caller* (so you always see who invoked); the remote's own name, message,
 * stack (dev only) and data live under `remote`.
 */
export class RozeniteHandlerError extends Error {
  readonly kind = 'handler' as const;
  readonly method: string;
  readonly remote: RemoteErrorInfo;

  constructor(method: string, remote: RemoteErrorInfo) {
    super(`${method} failed: ${remote.message}`);
    this.name = 'RozeniteHandlerError';
    this.method = method;
    this.remote = remote;
  }
}

export type RozeniteRpcError = RozeniteProtocolError | RozeniteHandlerError;

const hasKind = (
  error: unknown,
): error is { kind: unknown } & Record<string, unknown> =>
  typeof error === 'object' && error !== null && 'kind' in error;

/**
 * Narrow on `kind`, not `instanceof` — the panel and the device are separate
 * bundles, so `instanceof` only happens to work when the error was
 * constructed by the same bundle that's checking it.
 */
export const isProtocolError = (
  error: unknown,
): error is RozeniteProtocolError =>
  hasKind(error) && error.kind === 'protocol';

export const isHandlerError = (error: unknown): error is RozeniteHandlerError =>
  hasKind(error) && error.kind === 'handler';
