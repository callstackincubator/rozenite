// Types for Chrome DevTools Protocol Network events

export interface NetworkRequest {
  requestId: string;
  loaderId: string;
  documentURL: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    postData?: string;
    hasPostData?: boolean;
  };
  timestamp: number;
  wallTime: number;
  initiator: {
    type: string;
    stack?: {
      callFrames: Array<{
        functionName: string;
        scriptId: string;
        url: string;
        lineNumber: number;
        columnNumber: number;
      }>;
    };
  };
  redirectHasExtraInfo: boolean;
  redirectResponse?: any;
  referrerPolicy: string;
  type: string;
  frameId: string;
  hasUserGesture: boolean;
}

export interface NetworkRequestExtraInfo {
  requestId: string;
  blockedCookies: Array<{
    blockedReasons: string[];
    cookie: {
      name: string;
      value: string;
      domain: string;
      path: string;
      expires: number;
      size: number;
      httpOnly: boolean;
      secure: boolean;
      session: boolean;
      sameSite: string;
    };
  }>;
  headers: Record<string, string>;
  connectTiming: {
    requestTime: number;
  };
  clientSecurityState?: {
    initiatorIsSecureContext: boolean;
    initiatorIPAddressSpace: string;
    privateNetworkRequestPolicy: string;
  };
  siteHasCookieInOtherPartition: boolean;
}

export interface NetworkResponse {
  requestId: string;
  loaderId: string;
  timestamp: number;
  type: string;
  response: {
    url: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    mimeType: string;
    requestHeaders: Record<string, string>;
    requestHeadersText?: string;
    connectionReused: boolean;
    connectionId: number;
    remoteIPAddress?: string;
    remotePort?: number;
    protocol?: string;
    securityState: string;
    encodedDataLength: number;
    timing?: {
      requestTime: number;
      proxyStart: number;
      proxyEnd: number;
      dnsStart: number;
      dnsEnd: number;
      connectStart: number;
      connectEnd: number;
      sslStart: number;
      sslEnd: number;
      workerStart: number;
      workerReadyStart: number;
      workerReadyEnd: number;
      sendStart: number;
      sendEnd: number;
      pushStart: number;
      pushEnd: number;
      receiveHeadersEnd: number;
    };
    responseTime: number;
    fromDiskCache: boolean;
    fromServiceWorker: boolean;
    fromPrefetchCache: boolean;
    encodedBodySize: number;
    decodedBodySize: number;
    headersText?: string;
    serviceWorkerResponseSource?: string;
    responseSource: string;
    statusCode: number;
  };
  hasExtraInfo: boolean;
}

export interface NetworkLoadingFinished {
  requestId: string;
  timestamp: number;
  encodedDataLength: number;
  shouldReportCorbBlocking: boolean;
}

export interface NetworkLoadingFailed {
  requestId: string;
  timestamp: number;
  type: string;
  errorText: string;
  canceled?: boolean;
  blockedReason?: string;
}

export interface NetworkEventMap extends Record<string, unknown> {
  'Network.requestWillBeSent': NetworkRequest;
  'Network.requestWillBeSentExtraInfo': NetworkRequestExtraInfo;
  'Network.responseReceived': NetworkResponse;
  'Network.loadingFinished': NetworkLoadingFinished;
  'Network.loadingFailed': NetworkLoadingFailed;
}

export interface NetworkEntry {
  requestId: string;
  request: NetworkRequest;
  extraInfo?: NetworkRequestExtraInfo;
  response?: NetworkResponse;
  loadingFinished?: NetworkLoadingFinished;
  loadingFailed?: NetworkLoadingFailed;
  status: 'pending' | 'loading' | 'finished' | 'failed';
  startTime: number;
  endTime?: number;
  duration?: number;
} 