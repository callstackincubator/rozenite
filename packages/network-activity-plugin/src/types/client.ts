import { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { NetworkEntry } from './network';

// CDP Network types based on Chrome DevTools Protocol - limited to XMLHttpRequest capturable properties
export type NetworkRequestId = string;
export type NetworkLoaderId = string;
export type NetworkTimeSinceEpoch = number;
export type NetworkMonotonicTime = number;

export type NetworkRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  hasPostData?: boolean;
};

export type NetworkResponse = {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  mimeType: string;
  encodedDataLength: number;
  responseTime: NetworkTimeSinceEpoch;
};

export type NetworkInitiator = {
  type: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
};

export type NetworkResourceType =
  | 'Document'
  | 'Stylesheet'
  | 'Image'
  | 'Media'
  | 'Font'
  | 'Script'
  | 'XHR'
  | 'Fetch'
  | 'EventSource'
  | 'WebSocket'
  | 'Manifest'
  | 'Other'
  | 'Ping'
  | 'CSPViolationReport'
  | 'Preflight'
  | 'Subresource';

export type NetworkActivityEventMap = {
  // Control events
  'network-enable': unknown;
  'network-disable': unknown;

  // CDP Network events - limited to XMLHttpRequest capturable properties
  'Network.requestWillBeSent': {
    requestId: NetworkRequestId;
    loaderId: NetworkLoaderId;
    documentURL: string;
    request: NetworkRequest;
    timestamp: NetworkMonotonicTime;
    wallTime: NetworkTimeSinceEpoch;
    initiator: NetworkInitiator;
    type?: NetworkResourceType;
  };

  'Network.responseReceived': {
    requestId: NetworkRequestId;
    loaderId: NetworkLoaderId;
    timestamp: NetworkMonotonicTime;
    type: NetworkResourceType;
    response: NetworkResponse;
  };

  'Network.dataReceived': {
    requestId: NetworkRequestId;
    timestamp: NetworkMonotonicTime;
    dataLength: number;
    encodedDataLength: number;
  };

  'Network.loadingFinished': {
    requestId: NetworkRequestId;
    timestamp: NetworkMonotonicTime;
    encodedDataLength: number;
  };

  'Network.loadingFailed': {
    requestId: NetworkRequestId;
    timestamp: NetworkMonotonicTime;
    type: NetworkResourceType;
    errorText: string;
    canceled?: boolean;
  };

  'Network.getResponseBody': {
    requestId: NetworkRequestId;
  };

  'Network.responseBodyReceived': {
    requestId: NetworkRequestId;
    body: string;
    base64Encoded: boolean;
  };
};

export type NetworkActivityDevToolsClient =
  RozeniteDevToolsClient<NetworkActivityEventMap>;
