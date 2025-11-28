import {
  HttpMethod,
  XHRPostData,
  RequestPostData,
  RequestTextPostData,
  RequestBinaryPostData,
  RequestFormDataPostData,
} from '../../shared/client';
import { safeStringify } from '../../utils/safeStringify';
import { getStringSizeInBytes } from '../../utils/getStringSizeInBytes';
import { applyReactNativeResponseHeadersLogic } from '../../utils/applyReactNativeResponseHeadersLogic';
import {
  isBlob,
  isArrayBuffer,
  isFormData,
  isNullOrUndefined,
} from '../../utils/typeChecks';
import { getContentType } from '../utils';
import { getBlobName } from '../utils/getBlobName';
import { getFormDataEntries } from '../utils/getFormDataEntries';
import type { NetworkRequestRegistry } from './network-requests-registry';
import type { OverridesRegistry } from './overrides-registry';
import type { QueuedClientWrapper } from './queued-client-wrapper';

/**
 * Define how a single network request is tracked.
 */

const READY_STATE_HEADERS_RECEIVED = 2;

const getBinaryPostData = (body: Blob): RequestBinaryPostData => ({
  type: 'binary',
  value: {
    size: body.size,
    type: body.type,
    name: getBlobName(body),
  },
});

const getArrayBufferPostData = (
  body: ArrayBuffer | ArrayBufferView,
): RequestBinaryPostData => ({
  type: 'binary',
  value: {
    size: body.byteLength,
  },
});

const getTextPostData = (body: unknown): RequestTextPostData => ({
  type: 'text',
  value: safeStringify(body),
});

const getFormDataPostData = (body: FormData): RequestFormDataPostData => ({
  type: 'form-data',
  value: getFormDataEntries(body).reduce<RequestFormDataPostData['value']>(
    (acc, [key, value]) => {
      if (isBlob(value)) {
        acc[key] = getBinaryPostData(value);
      } else if (isArrayBuffer(value)) {
        acc[key] = getArrayBufferPostData(value);
      } else {
        acc[key] = getTextPostData(value);
      }

      return acc;
    },
    {},
  ),
});

const getRequestBody = (body: XHRPostData): RequestPostData => {
  if (isNullOrUndefined(body)) {
    return body;
  }

  if (isBlob(body)) {
    return getBinaryPostData(body);
  }

  if (isArrayBuffer(body)) {
    return getArrayBufferPostData(body);
  }

  if (isFormData(body)) {
    return getFormDataPostData(body);
  }

  return getTextPostData(body);
};

const getResponseSize = (request: XMLHttpRequest): number | null => {
  try {
    const { responseType, response } = request;

    // Handle a case of 204 where no-content was sent.
    if (response === null) {
      return 0;
    }

    if (responseType === '' || responseType === 'text') {
      return getStringSizeInBytes(request.responseText);
    }

    if (responseType === 'json') {
      return getStringSizeInBytes(safeStringify(response));
    }

    if (responseType === 'blob') {
      return response.size;
    }

    if (responseType === 'arraybuffer') {
      return response.byteLength;
    }

    return 0;
  } catch {
    return null;
  }
};

export const getResponseBody = async (
  request: XMLHttpRequest,
): Promise<string | null> => {
  const responseType = request.responseType;

  // Response type is empty in certain cases, like when using axios.
  if (responseType === '' || responseType === 'text') {
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

  if (responseType === 'json') {
    return safeStringify(request.response);
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

/**
 * Applies override body and status to XMLHttpRequest objects.
 */
export const setupRequestOverride = (
  overridesRegistry: OverridesRegistry,
  request: XMLHttpRequest,
): void => {
  const override = overridesRegistry.getOverrideForUrl(request._url as string);
  if (!override) return;

  request.addEventListener('readystatechange', () => {
    if (override.body !== undefined) {
      Object.defineProperty(request, 'responseType', { writable: true });
      Object.defineProperty(request, 'response', { writable: true });
      Object.defineProperty(request, 'responseText', { writable: true });

      const contentType = getContentType(request);
      if (contentType === 'application/json') {
        request.responseType = 'json';
      } else if (contentType === 'text/plain') {
        request.responseType = 'text';
      }

      // @ts-expect-error - Mocking response
      request.response = override.body;
      // @ts-expect-error - Mocking responseText
      request.responseText = override.body;
    }

    if (override.status !== undefined) {
      Object.defineProperty(request, 'status', { writable: true });
      // @ts-expect-error - Mocking status
      request.status = override.status;
    }
  });
};

export const setupRequestTracking = (
  queuedClient: QueuedClientWrapper,
  networkRequestsRegistry: NetworkRequestRegistry,
  data: XHRPostData,
  request: XMLHttpRequest,
): void => {
  const initiator = getInitiatorFromStack();
  const sendTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  request._rozeniteRequestId = requestId;
  networkRequestsRegistry.addEntry(requestId, request);

  let ttfb = 0;

  queuedClient.send('request-sent', {
    requestId: requestId,
    timestamp: sendTime,
    request: {
      url: request._url as string,
      method: request._method as HttpMethod,
      headers: request._headers,
      postData: getRequestBody(data),
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
    queuedClient.send('response-received', {
      requestId: requestId,
      timestamp: Date.now(),
      type: 'XHR',
      response: {
        url: request._url as string,
        status: request.status,
        statusText: request.statusText,
        headers: applyReactNativeResponseHeadersLogic(
          request.responseHeaders || {},
        ),
        contentType: getContentType(request),
        size: getResponseSize(request),
        responseTime: Date.now(),
      },
    });
  });

  request.addEventListener('loadend', () => {
    queuedClient.send('request-completed', {
      requestId: requestId,
      timestamp: Date.now(),
      duration: Date.now() - sendTime,
      size: getResponseSize(request),
      ttfb,
    });
  });

  request.addEventListener('error', () => {
    queuedClient.send('request-failed', {
      requestId: requestId,
      timestamp: Date.now(),
      type: 'XHR',
      error: 'Failed',
      canceled: false,
    });
  });

  request.addEventListener('abort', () => {
    queuedClient.send('request-failed', {
      requestId: requestId,
      timestamp: Date.now(),
      type: 'XHR',
      error: 'Aborted',
      canceled: true,
    });
  });
};
