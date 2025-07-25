import { NetworkActivityDevToolsClient } from '../types/client';
import { getNetworkRequestsRegistry } from './network-requests-registry';
import { XHRInterceptor } from './xhr-interceptor';

const networkRequestsRegistry = getNetworkRequestsRegistry();

const mimeTypeFromResponseType = (responseType: string): string | undefined => {
  switch (responseType) {
    case 'arraybuffer':
    case 'blob':
    case 'base64':
      return 'application/octet-stream';
    case 'text':
    case '':
      return 'text/plain';
    case 'json':
      return 'application/json';
    case 'document':
      return 'text/html';
  }

  return undefined;
};

const parseHeaders = (headersString: string): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (!headersString) return headers;

  const lines = headersString.split('\r\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      headers[key] = value;
    }
  }
  return headers;
};

const getResponseBody = async (
  request: XMLHttpRequest
): Promise<{ body: string; base64Encoded: boolean }> => {
  try {
    if (request.responseType === 'arraybuffer') {
      const arrayBuffer = request.response as ArrayBuffer;
      return {
        body: btoa(String.fromCharCode(...new Uint8Array(arrayBuffer))),
        base64Encoded: true,
      };
    }

    if (request.responseType === 'blob') {
      const contentType = request.getResponseHeader('Content-Type') || '';

      if (
        contentType.startsWith('text/') ||
        contentType.startsWith('application/json')
      ) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              body: reader.result as string,
              base64Encoded: false,
            });
          };
          reader.readAsText(request.response);
        });
      }
    }

    if (request.responseType === 'text') {
      return {
        body: request.responseText || request.response || '',
        base64Encoded: false,
      };
    }

    return {
      body: request.responseText || request.response || '',
      base64Encoded: false,
    };
  } catch (error) {
    return {
      body: `[Error reading response: ${error}]`,
      base64Encoded: false,
    };
  }
};

const findRequestId = (request: XMLHttpRequest): string | null => {
  const allRequests = networkRequestsRegistry.getAllEntries();
  const entry = allRequests.find(({ request: req }) => req === request);
  return entry?.id ?? null;
};

const getInitiatorFromStack = (): {
  type: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
} => {
  try {
    const stack = new Error().stack;
    if (!stack) {
      return { type: 'other' };
    }

    const line = stack.split('\n')[9];
    const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
    if (match) {
      return {
        type: 'script',
        url: match[2],
        lineNumber: parseInt(match[3]),
        columnNumber: parseInt(match[4]),
      };
    }
  } catch {
    // Ignore stack parsing errors
  }

  return { type: 'other' };
};

export type NetworkInspector = {
  enable: () => void;
  disable: () => void;
  isEnabled: () => boolean;
  dispose: () => void;
};

export const getNetworkInspector = (
  pluginClient: NetworkActivityDevToolsClient
): NetworkInspector => {
  const generateRequestId = (): string => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const generateLoaderId = (): string => {
    return `loader_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const enable = () => {
    XHRInterceptor.disableInterception();

    XHRInterceptor.setOpenCallback(
      (method: string, url: string, request: XMLHttpRequest) => {
        const requestId = generateRequestId();
        const loaderId = generateLoaderId();
        const startTime = Date.now();
        const initiator = getInitiatorFromStack();

        // Store request in registry with metadata
        networkRequestsRegistry.addEntry(requestId, request, {
          id: requestId,
          loaderId,
          documentURL:
            typeof document !== 'undefined' ? document.URL : undefined,
          method,
          url,
          headers: request?._headers || {},
          startTime,
          status: 'pending',
          type: 'XHR',
          initiator,
        });
      }
    );

    XHRInterceptor.setSendCallback((data: string, request: XMLHttpRequest) => {
      const requestId = findRequestId(request);
      if (!requestId) return;

      const entry = networkRequestsRegistry.getEntry(requestId);
      if (!entry) return;

      const metadata = entry.metadata;

      // Update metadata with post data
      networkRequestsRegistry.updateEntry(requestId, {
        postData: data,
        hasPostData: !!data,
        headers: request?._headers || {},
      });

      // Send Network.requestWillBeSent event
      pluginClient.send('Network.requestWillBeSent', {
        requestId,
        loaderId: metadata.loaderId || '',
        documentURL: metadata.documentURL || '',
        request: {
          url: metadata.url,
          method: metadata.method,
          headers: metadata.headers,
          postData: data,
          hasPostData: !!data,
        },
        timestamp: metadata.startTime,
        wallTime: metadata.startTime,
        initiator: metadata.initiator || { type: 'other' },
        type: metadata.type,
      });
    });

    XHRInterceptor.setHeaderReceivedCallback(
      (
        responseContentType: string | void,
        responseSize: number | void,
        allHeaders: string,
        request: XMLHttpRequest
      ) => {
        const requestId = findRequestId(request);
        if (!requestId) return;

        const entry = networkRequestsRegistry.getEntry(requestId);
        if (!entry) return;

        const metadata = entry.metadata;
        const headers = parseHeaders(allHeaders);
        const mimeType =
          responseContentType ||
          mimeTypeFromResponseType(request.responseType) ||
          'text/plain';

        // Update metadata with response info
        networkRequestsRegistry.updateEntry(requestId, {
          status: 'loading',
          response: {
            url: metadata.url,
            status: request.status,
            statusText: request.statusText,
            headers,
            mimeType,
            encodedDataLength: responseSize || 0,
            responseTime: Date.now(),
          },
        });

        // Send Network.responseReceived event
        pluginClient.send('Network.responseReceived', {
          requestId,
          loaderId: metadata.loaderId || '',
          timestamp: Date.now(),
          type: metadata.type || 'Other',
          response: {
            url: metadata.url,
            status: request.status,
            statusText: request.statusText,
            headers,
            mimeType,
            encodedDataLength: responseSize || 0,
            responseTime: Date.now(),
          },
        });
      }
    );

    XHRInterceptor.setResponseCallback(
      (
        status: number,
        timeout: number,
        response: string,
        responseURL: string,
        responseType: string,
        request: XMLHttpRequest
      ) => {
        const requestId = findRequestId(request);
        if (!requestId) return;

        const entry = networkRequestsRegistry.getEntry(requestId);
        if (!entry) return;

        const metadata = entry.metadata;
        if (!metadata) return;

        const endTime = Date.now();
        const duration = endTime - metadata.startTime;
        const dataLength = response ? response.length : 0;

        // Update metadata with final data
        networkRequestsRegistry.updateEntry(requestId, {
          endTime,
          duration,
          dataLength,
          encodedDataLength: dataLength,
        });

        // Check if request failed
        if (status >= 400 || request.readyState === 0) {
          const errorText = request.statusText || 'Request failed';
          const canceled = request.readyState === 0;

          // Update metadata
          networkRequestsRegistry.updateEntry(requestId, {
            status: 'failed',
            errorText,
            canceled,
          });

          // Send Network.loadingFailed event
          pluginClient.send('Network.loadingFailed', {
            requestId,
            timestamp: endTime,
            type: metadata.type || 'Other',
            errorText,
            canceled,
          });
        } else {
          // Update metadata
          networkRequestsRegistry.updateEntry(requestId, {
            status: 'finished',
            encodedDataLength: dataLength,
          });

          // Send Network.dataReceived event if there's data
          if (dataLength > 0) {
            pluginClient.send('Network.dataReceived', {
              requestId,
              timestamp: endTime,
              dataLength,
              encodedDataLength: dataLength,
            });
          }

          // Send Network.loadingFinished event
          pluginClient.send('Network.loadingFinished', {
            requestId,
            timestamp: endTime,
            encodedDataLength: dataLength,
          });
        }
      }
    );

    XHRInterceptor.enableInterception();
  };

  const disable = () => {
    XHRInterceptor.disableInterception();
    networkRequestsRegistry.clear();
  };

  const isEnabled = () => {
    return XHRInterceptor.isInterceptorEnabled();
  };

  const enableSubscription = pluginClient.onMessage('network-enable', () => {
    enable();
  });

  const disableSubscription = pluginClient.onMessage('network-disable', () => {
    disable();
  });

  const handleBodySubscription = pluginClient.onMessage(
    'Network.getResponseBody',
    async (payload) => {
      const requestId = payload.requestId;
      const entry = networkRequestsRegistry.getEntry(requestId);
      if (!entry) {
        return;
      }

      const { request } = entry;
      const { body, base64Encoded } = await getResponseBody(request);

      // Send Network.responseBodyReceived event
      pluginClient.send('Network.responseBodyReceived', {
        requestId,
        body,
        base64Encoded,
      });
    }
  );

  const dispose = () => {
    disable();
    enableSubscription.remove();
    disableSubscription.remove();
    handleBodySubscription.remove();
  };

  return {
    enable,
    disable,
    isEnabled,
    dispose,
  };
};
