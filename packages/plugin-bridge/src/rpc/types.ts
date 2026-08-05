import { Subscription } from '../types.js';

export type RpcMethods = Record<string, (...args: never[]) => unknown>;

export type InvokeArgs<M extends RpcMethods, K extends keyof M> =
  Parameters<M[K]> extends []
    ? [options?: InvokeOptions]
    : [params: Parameters<M[K]>[0], options?: InvokeOptions];

export type RpcContext = {
  /** Aborts when the caller cancels, times out, or gives up. */
  signal: AbortSignal;
  /** Piggybacks on the next heartbeat frame. */
  progress(value: unknown): void;
};

export type InvokeOptions = {
  signal?: AbortSignal;
  /** `request` -> `ack` window. Default `5_000`. */
  ackTimeoutMs?: number;
  /** Caller-dictated heartbeat cadence, sent in the request. Default `2_000`. */
  heartbeatMs?: number;
  /** Window since the last `ack`/`heartbeat`. Default `6_000` (3x `heartbeatMs`). */
  staleTimeoutMs?: number;
  /** Absolute `request` -> settle cap. Default `30_000`. Pass `Infinity` to opt out. */
  timeoutMs?: number;
  /** Retries `ACK_TIMEOUT` only. Default `1`. */
  retries?: number;
  onProgress?: (value: unknown) => void;
};

export type RozeniteRpc<M extends RpcMethods> = {
  invoke<K extends keyof M>(
    method: K,
    ...args: InvokeArgs<M, K>
  ): Promise<Awaited<ReturnType<M[K]>>>;

  handle<K extends keyof M>(
    method: K,
    handler: (params: Parameters<M[K]>[0], ctx: RpcContext) => ReturnType<M[K]>,
  ): Subscription;

  close(): void;
};
