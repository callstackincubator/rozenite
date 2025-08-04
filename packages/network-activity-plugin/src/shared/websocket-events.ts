export type WebSocketMessageType = 'text' | 'binary';

export type WebSocketConnectionStatus =
  | 'connecting'
  | 'open'
  | 'closing'
  | 'closed';

export type WebSocketConnectEvent = {
  type: 'websocket-connect';
  url: string;
  socketId: number;
  timestamp: number;
  protocols: string[] | null;
  options: string[];
};

export type WebSocketOpenEvent = {
  type: 'websocket-open';
  url: string;
  socketId: number;
  timestamp: number;
};

export type WebSocketCloseEvent = {
  type: 'websocket-close';
  url: string;
  socketId: number;
  timestamp: number;
  code: number;
  reason?: string;
};

export type WebSocketMessageSentEvent = {
  type: 'websocket-message-sent';
  url: string;
  socketId: number;
  timestamp: number;
  data: string;
  messageType: WebSocketMessageType;
};

export type WebSocketMessageReceivedEvent = {
  type: 'websocket-message-received';
  url: string;
  socketId: number;
  timestamp: number;
  data: string;
  messageType: WebSocketMessageType;
};

export type WebSocketErrorEvent = {
  type: 'websocket-error';
  url: string;
  socketId: number;
  timestamp: number;
  error: string;
};

export type WebSocketConnectionStatusChangedEvent = {
  type: 'websocket-connection-status-changed';
  url: string;
  socketId: number;
  timestamp: number;
  status: WebSocketConnectionStatus;
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
