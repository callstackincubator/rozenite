import type { Response } from './client';

export type SSEConnectionStatus = 'connecting' | 'open' | 'closed';
export type SSERequestId = string;

export type SSEOpenEvent = {
  type: 'sse-open';
  requestId: SSERequestId;
  timestamp: number;
  response: Response;
};

export type SSEMessageEvent = {
  type: 'sse-message';
  requestId: SSERequestId;
  timestamp: number;
  payload: {
    type: string;
    data: string;
  };
};

export type SSEErrorEvent = {
  type: 'sse-error';
  requestId: SSERequestId;
  timestamp: number;
  error: {
    type: 'error' | 'timeout' | 'exception';
    message: string;
  };
};

export type SSECloseEvent = {
  type: 'sse-close';
  requestId: SSERequestId;
  timestamp: number;
};

export type SSEEvent =
  | SSEOpenEvent
  | SSEMessageEvent
  | SSEErrorEvent
  | SSECloseEvent;

export type SSEEventMap = {
  [K in SSEEvent['type']]: Extract<SSEEvent, { type: K }>;
};
