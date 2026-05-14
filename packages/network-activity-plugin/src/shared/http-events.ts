export type HttpHeaders = Record<string, string | string[]>;
export type XHRHeaders = NonNullable<XMLHttpRequest['responseHeaders']>;

// Discriminated union for response bodies on the bridge.
//   string → text body (today's path)
//   { kind: 'binary' } → base64-encoded binary payload (e.g. images)
//   { kind: 'binary-too-large' } → response exceeded the in-capture size cap; bytes not shipped
//   null → body could not be read at all
export type ResponseBody =
  | string
  | { kind: 'binary'; base64: string }
  | { kind: 'binary-too-large'; size: number }
  | null;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

export type RequestId = string;
export type Timestamp = number;
export type NetworkEventSource = 'builtin' | 'nitro';

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

export type RequestOverride = {
  status?: number;
  body?: string;
};

export type HttpEventMap = {
  'request-sent': {
    requestId: RequestId;
    request: Request;
    timestamp: Timestamp;
    initiator: Initiator;
    type: ResourceType;
    source?: NetworkEventSource;
  };

  'response-received': {
    requestId: RequestId;
    timestamp: Timestamp;
    type: ResourceType;
    response: Response;
    source?: NetworkEventSource;
  };

  'request-completed': {
    requestId: RequestId;
    timestamp: Timestamp;
    duration: number;
    size: number | null;
    ttfb: number;
    source?: NetworkEventSource;
  };

  'request-failed': {
    requestId: RequestId;
    timestamp: Timestamp;
    type: ResourceType;
    error: string;
    canceled: boolean;
    source?: NetworkEventSource;
  };

  'request-progress': {
    requestId: RequestId;
    timestamp: Timestamp;
    loaded: number;
    total: number;
    lengthComputable: boolean;
    source?: NetworkEventSource;
  };

  'get-response-body': {
    requestId: RequestId;
  };

  'response-body': {
    requestId: RequestId;
    body: ResponseBody;
  };

  'set-overrides': {
    overrides: [string, RequestOverride][];
  };
};
