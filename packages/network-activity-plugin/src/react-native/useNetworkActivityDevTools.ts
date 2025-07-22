import { useEffect } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { NetworkEventMap } from '../types/network';

let requestCounter = 0;

function generateRequestId() {
  return (++requestCounter).toString();
}

// Helper function to convert Headers object to plain object
function headersToObject(headers: HeadersInit | Record<string, string>): Record<string, string> {
  if (headers instanceof Headers) {
    const obj: Record<string, string> = {};
    headers.forEach((value: string, key: string) => {
      obj[key] = value;
    });
    return obj;
  } else if (Array.isArray(headers)) {
    const obj: Record<string, string> = {};
    headers.forEach(([key, value]) => {
      obj[key] = value;
    });
    return obj;
  }
  return headers as Record<string, string>;
}

// Helper function to get request info from fetch input
function getRequestInfo(input: RequestInfo | URL, init?: RequestInit) {
  let url: string;
  let method: string;
  let headers: Record<string, string>;
  let body: unknown;

  if (typeof input === 'string') {
    url = input;
    method = init?.method || 'GET';
    headers = headersToObject(init?.headers || {});
    body = init?.body || undefined;
  } else if (input instanceof Request) {
    url = input.url;
    method = input.method;
    headers = headersToObject(input.headers);
    body = input.body || undefined;
  } else {
    // URL object
    url = input.toString();
    method = init?.method || 'GET';
    headers = headersToObject(init?.headers || {});
    body = init?.body || undefined;
  }

  return { url, method, headers, body };
}

export const useNetworkActivityDevTools = () => {
  const client = useRozeniteDevToolsClient<NetworkEventMap>({
    pluginId: '@rozenite/network-activity-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const originalFetch = window.fetch.bind(window);

    const sendCdpEvent = (method: keyof NetworkEventMap, params: NetworkEventMap[keyof NetworkEventMap]) => {
      client.send(method, params);
    };

    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
      const requestId = generateRequestId();
      const requestInfo = getRequestInfo(input, init);
      const timestamp = Date.now() / 1000;
      const wallTime = timestamp;

      sendCdpEvent('Network.requestWillBeSent', {
        requestId,
        loaderId: requestId,
        documentURL: '',
        request: {
          url: requestInfo.url,
          method: requestInfo.method,
          headers: requestInfo.headers,
          postData: requestInfo.body,
          hasPostData: !!requestInfo.body
        },
        timestamp,
        wallTime,
        initiator: { 
          type: 'script',
          stack: {
            callFrames: [
              {
                functionName: 'fetch',
                scriptId: '1',
                url: '',
                lineNumber: 1,
                columnNumber: 1
              }
            ]
          }
        },
        redirectHasExtraInfo: false,
        redirectResponse: null,
        referrerPolicy: 'no-referrer',
        type: 'Fetch',
        frameId: '1',
        hasUserGesture: false
      });

      sendCdpEvent('Network.requestWillBeSentExtraInfo', {
        requestId,
        blockedCookies: [],
        headers: requestInfo.headers,
        connectTiming: { 
          requestTime: timestamp 
        },
        clientSecurityState: {
          initiatorIsSecureContext: false,
          initiatorIPAddressSpace: 'Public',
          privateNetworkRequestPolicy: 'Allow'
        },
        siteHasCookieInOtherPartition: false
      });

      let response;
      try {
        response = await originalFetch(input, init);

        // Get response headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value: string, key: string) => {
          responseHeaders[key] = value;
        });

        const contentType = response.headers.get('content-type') || '';
        const contentLength = response.headers.get('content-length');
        const encodedDataLength = contentLength ? parseInt(contentLength, 10) : 0;
        
        // Get decoded body size (actual response size)
        let decodedBodySize = encodedDataLength;
        try {
          const responseClone = response.clone();
          const arrayBuffer = await responseClone.arrayBuffer();
          decodedBodySize = arrayBuffer.byteLength;
        } catch {
          // Fallback to content-length if we can't read the response
          decodedBodySize = encodedDataLength;
        }

        sendCdpEvent('Network.responseReceived', {
          requestId,
          loaderId: requestId,
          timestamp: Date.now() / 1000,
          type: 'Fetch',
          response: {
            url: requestInfo.url,
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            mimeType: contentType,
            requestHeaders: requestInfo.headers,
            requestHeadersText: undefined,
            connectionReused: false,
            connectionId: 0,
            remoteIPAddress: undefined,
            remotePort: undefined,
            protocol: undefined,
            securityState: 'unknown',
            encodedDataLength,
            timing: {
              requestTime: timestamp,
              proxyStart: -1,
              proxyEnd: -1,
              dnsStart: -1,
              dnsEnd: -1,
              connectStart: -1,
              connectEnd: -1,
              sslStart: -1,
              sslEnd: -1,
              workerStart: -1,
              workerReadyStart: -1,
              workerReadyEnd: -1,
              sendStart: timestamp,
              sendEnd: timestamp,
              pushStart: -1,
              pushEnd: -1,
              receiveHeadersEnd: Date.now() / 1000
            },
            responseTime: Date.now() / 1000,
            fromDiskCache: false,
            fromServiceWorker: false,
            fromPrefetchCache: false,
            encodedBodySize: encodedDataLength,
            decodedBodySize: decodedBodySize,
            headersText: undefined,
            serviceWorkerResponseSource: undefined,
            responseSource: 'network',
            statusCode: response.status
          },
          hasExtraInfo: false
        });

        sendCdpEvent('Network.loadingFinished', {
          requestId,
          timestamp: Date.now() / 1000,
          encodedDataLength,
          shouldReportCorbBlocking: false
        });

        return response;
      } catch (err) {
        sendCdpEvent('Network.loadingFailed', {
          requestId,
          timestamp: Date.now() / 1000,
          type: 'Fetch',
          errorText: err instanceof Error ? err.message : 'Unknown error',
          canceled: false,
          blockedReason: undefined
        });
        
        throw err;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [client]);

  return client;
};