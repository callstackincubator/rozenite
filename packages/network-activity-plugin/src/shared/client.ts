import { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { WebSocketEventMap } from './websocket-events';
import { SSEEventMap } from './sse-events';

export type HttpHeaders = Record<string, string | string[]>;
export type XHRHeaders = NonNullable<XMLHttpRequest['responseHeaders']>;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

export type RequestId = string;
export type Timestamp = number;

export type XHRPostData =
  | string
  | Blob
  | FormData
  | ArrayBuffer
  | ArrayBufferView
  | unknown
  | null
  | undefined;

export type RequestTextPostData = {
  type: 'text';
  value: string;
};

export type RequestBinaryPostData = {
  type: 'binary';
  value: {
    size: number;
    type?: string;
    name?: string;
  };
};

export type RequestFormDataPostData = {
  type: 'form-data';
  value: Record<string, RequestTextPostData | RequestBinaryPostData>;
};

export type RequestPostData =
  | RequestTextPostData
  | RequestFormDataPostData
  | RequestBinaryPostData
  | null
  | undefined;

export type Cookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  maxAge?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
};

export type Request = {
  url: string;
  method: HttpMethod;
  headers: HttpHeaders;
  postData?: RequestPostData;
};

export type Response = {
  url: string;
  status: number;
  statusText: string;
  headers: HttpHeaders;
  contentType: string;
  size: number | null;
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
    size: number | null;
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
} & WebSocketEventMap &
  SSEEventMap;

export type NetworkActivityDevToolsClient =
  RozeniteDevToolsClient<NetworkActivityEventMap>;
