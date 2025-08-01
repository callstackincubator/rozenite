import { NetworkActivityDevToolsClient } from '../shared/client';
import { getHttpHeaderValue } from '../ui/utils/getHttpHeaderValue';
import { getNetworkRequestsRegistry } from './network-requests-registry';
import { XHRInterceptor } from './xhr-interceptor';

const networkRequestsRegistry = getNetworkRequestsRegistry();

const getContentType = (request: XMLHttpRequest): string => {
  const responseHeaders = request.responseHeaders;
  const responseType = request.responseType;

  const contentType = getHttpHeaderValue(responseHeaders || {}, 'content-type');

  if (contentType) {
    return contentType.split(';')[0].trim();
  }

  switch (responseType) {
    case 'arraybuffer':
    case 'blob':
      return 'application/octet-stream';
    case 'text':
    case '':
      return 'text/plain';
    case 'json':
      return 'application/json';
    case 'document':
      return 'text/html';
  }
};

const getResponseSize = (request: XMLHttpRequest): number => {
  if (typeof request.response === 'object') {
    return request.response.size;
  }

  return request.response.length || 0;
};

const getResponseBody = async (
  request: XMLHttpRequest
): Promise<string | null> => {
  const responseType = request.responseType;

  if (responseType === 'text') {
    return request.responseText as string;
  }

  if (responseType === 'blob') {
    // This may be a text blob.
    const contentType = request.getResponseHeader('Content-Type') || '';

    if (
      contentType.startsWith('text/') ||
      contentType.startsWith('application/json')
    ) {
      // It looks like a text blob, let's read it and forward it to the client.
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(reader.result as string);
        };
        reader.readAsText(request.response);
      });
    }
  }

  return null;
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

const READY_STATE_HEADERS_RECEIVED = 2;

export const getNetworkInspector = (
  pluginClient: NetworkActivityDevToolsClient
): NetworkInspector => {
  const generateRequestId = (): string => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleRequestSend = (data: string, request: XMLHttpRequest): void => {
    const sendTime = Date.now();

    const requestId = generateRequestId();
    const initiator = getInitiatorFromStack();

    networkRequestsRegistry.addEntry(requestId, request);

    let ttfb = 0;

    pluginClient.send('request-sent', {
      requestId: requestId,
      timestamp: sendTime / 1000,
      request: {
        url: request._url as string,
        method: request._method as string,
        headers: request._headers,
        postData: data,
      },
      type: 'XHR',
      initiator,
    });

    request.addEventListener('readystatechange', () => {
      if (request.readyState === READY_STATE_HEADERS_RECEIVED) {
        ttfb = Date.now() - sendTime;
      }
    });

    request.addEventListener('load', () => {
      pluginClient.send('response-received', {
        requestId: requestId,
        timestamp: Date.now() / 1000,
        type: 'XHR',
        response: {
          url: request._url as string,
          status: request.status,
          statusText: request.statusText,
          headers: request.responseHeaders || {},
          contentType: getContentType(request),
          size: getResponseSize(request),
          responseTime: Date.now() / 1000,
        },
      });
    });

    request.addEventListener('loadend', () => {
      pluginClient.send('request-completed', {
        requestId: requestId,
        timestamp: Date.now() / 1000,
        duration: Date.now() - sendTime,
        size: getResponseSize(request),
        ttfb,
      });
    });

    request.addEventListener('error', () => {
      pluginClient.send('request-failed', {
        requestId: requestId,
        timestamp: Date.now() / 1000,
        type: 'XHR',
        error: 'Failed',
        canceled: false,
      });
    });

    request.addEventListener('abort', () => {
      pluginClient.send('request-failed', {
        requestId: requestId,
        timestamp: Date.now() / 1000,
        type: 'XHR',
        error: 'Aborted',
        canceled: true,
      });
    });
  };

  const enable = () => {
    XHRInterceptor.disableInterception();
    XHRInterceptor.setSendCallback(handleRequestSend);
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
    'get-response-body',
    async ({ requestId }) => {
      const request = networkRequestsRegistry.getEntry(requestId);

      if (!request) {
        return;
      }

      const body = await getResponseBody(request);

      pluginClient.send('response-body', {
        requestId,
        body,
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
