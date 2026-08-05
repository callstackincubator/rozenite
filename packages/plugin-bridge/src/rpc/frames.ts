import { ProtocolErrorCode } from './errors.js';

/**
 * The single message type RPC reserves on the underlying
 * `RozeniteDevToolsClient`. All RPC frames ride inside its payload — no
 * changes to `Channel` or to the message envelope are needed. A plugin's own
 * event map must not use this type.
 */
export const ROZENITE_RPC_MESSAGE_TYPE = 'rozenite:rpc';

export type RequestFrame = {
  kind: 'request';
  id: string;
  method: string;
  params?: unknown;
  /** Caller-dictated heartbeat cadence, sent so the receiver knows the rate. */
  heartbeatMs: number;
};

export type AckFrame = {
  kind: 'ack';
  id: string;
};

export type HeartbeatFrame = {
  kind: 'heartbeat';
  id: string;
  /** Piggybacks the latest `ctx.progress()` value, if any was reported. */
  progress?: unknown;
};

export type ResultFrame = {
  kind: 'result';
  id: string;
  value: unknown;
};

export type ProtocolErrorFrame = {
  kind: 'error';
  id: string;
  source: 'protocol';
  code: ProtocolErrorCode;
  message: string;
};

export type HandlerErrorFrame = {
  kind: 'error';
  id: string;
  source: 'handler';
  name: string;
  message: string;
  /** Dev only — see `./dev.ts`. */
  stack?: string;
  data?: unknown;
};

export type ErrorFrame = ProtocolErrorFrame | HandlerErrorFrame;

export type CancelFrame = {
  kind: 'cancel';
  id: string;
};

export type RpcFrame =
  | RequestFrame
  | AckFrame
  | HeartbeatFrame
  | ResultFrame
  | ErrorFrame
  | CancelFrame;
