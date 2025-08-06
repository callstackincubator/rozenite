import { Initiator, ResourceType } from '../../shared/client';

export type RequestId = string;
export type Timestamp = number;
export type SocketId = number;
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

export type NetworkEntryType = 'http' | 'websocket';

/* HTTP */
export type HttpData = {
  type: string;
  data: string;
};

export type HttpRequest = {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body?: HttpData;
};

export type HttpResponse = {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  contentType: string;
  size: number;
  responseTime: Timestamp;
  body?: HttpData;
};

export type HttpStatus = 'pending' | 'loading' | 'finished' | 'failed';

export type HttpNetworkEntry = {
  id: RequestId;
  type: 'http';
  timestamp: Timestamp;
  duration?: number;

  request: HttpRequest;
  response?: HttpResponse;
  status: HttpStatus;
  error?: string;
  canceled?: boolean;
  ttfb?: number;
  size?: number;
  initiator?: Initiator;
  resourceType?: ResourceType;
};

/* WebSocket */
export type WebSocketConnection = {
  url: string;
  socketId: SocketId;
  protocols?: string[];
  options?: string[];
};

export type WebSocketMessage = {
  id: string;
  direction: 'sent' | 'received';
  data: string;
  messageType: 'text' | 'binary';
  timestamp: Timestamp;
};

export type WebSocketStatus =
  | 'connecting'
  | 'open'
  | 'closing'
  | 'closed'
  | 'error';

export type WebSocketNetworkEntry = {
  id: RequestId;
  type: 'websocket';
  timestamp: Timestamp;
  duration?: number;

  connection: WebSocketConnection;
  status: WebSocketStatus;
  error?: string;
  closeCode?: number;
  closeReason?: string;
};

/* Shared */
export type NetworkEntry = HttpNetworkEntry | WebSocketNetworkEntry;

export type ProcessedRequest = {
  id: RequestId;
  type: NetworkEntryType;
  name: string;
  status: HttpStatus | WebSocketStatus;
  timestamp: Timestamp;
  duration?: number;
  size?: number;
  method: HttpMethod | 'WS';
  httpStatus?: number;
};
