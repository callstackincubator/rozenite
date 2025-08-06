import { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { WebSocketEventMap } from './websocket-events';

export type HttpHeaders = Record<string, string>;
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

export type RequestId = string;
export type Timestamp = number;

export type Request = {
  url: string;
  method: HttpMethod;
  headers: HttpHeaders;
  postData?: string;
};

export type Response = {
  url: string;
  status: number;
  statusText: string;
  headers: HttpHeaders;
  contentType: string;
  size: number;
  responseTime: Timestamp;
};

export type Initiator = {
  type: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
};

export type ResourceType = 'XHR' | 'Fetch' | 'Other';

export type NetworkActivityEventMap = {
  // Control events
  'network-enable': unknown;
  'network-disable': unknown;

  // Network request events
  'request-sent': {
    requestId: RequestId;
    request: Request;
    timestamp: Timestamp;
    initiator: Initiator;
    type: ResourceType;
  };

  'response-received': {
    requestId: RequestId;
    timestamp: Timestamp;
    type: ResourceType;
    response: Response;
  };

  'request-completed': {
    requestId: RequestId;
    timestamp: Timestamp;
    duration: number;
    size: number;
    ttfb: number;
  };

  'request-failed': {
    requestId: RequestId;
    timestamp: Timestamp;
    type: ResourceType;
    error: string;
    canceled: boolean;
  };

  'get-response-body': {
    requestId: RequestId;
  };

  'response-body': {
    requestId: RequestId;
    body: string | null;
  };
} & WebSocketEventMap;

export type NetworkActivityDevToolsClient =
  RozeniteDevToolsClient<NetworkActivityEventMap>;
