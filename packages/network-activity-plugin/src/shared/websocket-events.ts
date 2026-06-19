import type { NetworkEventSource } from './http-events';

export type WebSocketMessageType = 'text' | 'binary';

export type WebSocketConnectionStatus =
  | 'connecting'
  | 'open'
  | 'closing'
  | 'closed';

export type WebSocketConnectEvent = {
  type: 'websocket-connect';
  url: string;
  socketId: string;
  timestamp: number;
  protocols: string[] | null;
  options: string[];
  source?: NetworkEventSource;
};

export type WebSocketOpenEvent = {
  type: 'websocket-open';
  url: string;
  socketId: string;
  timestamp: number;
  source?: NetworkEventSource;
};

export type WebSocketCloseEvent = {
  type: 'websocket-close';
  url: string;
  socketId: string;
  timestamp: number;
  code: number;
  reason?: string;
  source?: NetworkEventSource;
};

export type WebSocketMessageSentEvent = {
  type: 'websocket-message-sent';
  url: string;
  socketId: string;
  timestamp: number;
  data: string;
  messageType: WebSocketMessageType;
  source?: NetworkEventSource;
};

export type WebSocketMessageReceivedEvent = {
  type: 'websocket-message-received';
  url: string;
  socketId: string;
  timestamp: number;
  data: string;
  messageType: WebSocketMessageType;
  source?: NetworkEventSource;
};

export type WebSocketErrorEvent = {
  type: 'websocket-error';
  url: string;
  socketId: string;
  timestamp: number;
  error: string;
  source?: NetworkEventSource;
};

export type WebSocketConnectionStatusChangedEvent = {
  type: 'websocket-connection-status-changed';
  url: string;
  socketId: string;
  timestamp: number;
  status: WebSocketConnectionStatus;
  source?: NetworkEventSource;
};

export type WebSocketEvent =
  | WebSocketConnectEvent
  | WebSocketOpenEvent
  | WebSocketCloseEvent
  | WebSocketMessageSentEvent
  | WebSocketMessageReceivedEvent
  | WebSocketErrorEvent
  | WebSocketConnectionStatusChangedEvent;

export type WebSocketEventMap = {
  [K in WebSocketEvent['type']]: Extract<WebSocketEvent, { type: K }>;
};
