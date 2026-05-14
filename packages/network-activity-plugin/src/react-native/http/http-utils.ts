import {
  XHRPostData,
  RequestPostData,
  RequestTextPostData,
  RequestBinaryPostData,
  RequestFormDataPostData,
  ResponseBody,
} from '../../shared/client';
import { safeStringify } from '../../utils/safeStringify';
import { getStringSizeInBytes } from '../../utils/getStringSizeInBytes';
import { isJsonContentType } from '../../utils/getContentTypeMimeType';
import {
  isBlob,
  isArrayBuffer,
  isFormData,
  isNullOrUndefined,
} from '../../utils/typeChecks';
import { getContentType } from '../utils';
import { getBlobName } from '../utils/getBlobName';
import { getFormDataEntries } from '../utils/getFormDataEntries';
import type { OverridesRegistry } from './overrides-registry';

/**
 * Utility functions for tracking HTTP requests
 */

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
  value: Array.from(getFormDataEntries(body)).reduce<
    RequestFormDataPostData['value']
  >((acc, [key, value]) => {
    if (isBlob(value)) {
      acc[key] = getBinaryPostData(value);
    } else if (isArrayBuffer(value)) {
      acc[key] = getArrayBufferPostData(value);
    } else {
      acc[key] = getTextPostData(value);
    }

    return acc;
  }, {}),
});

export const getRequestBody = (body: XHRPostData): RequestPostData => {
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

export const getResponseSize = (request: XMLHttpRequest): number | null => {
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

// Cap on binary capture. Above this, we ship a 'binary-too-large' variant
// with just the size — no bytes cross the bridge. 5MB comfortably covers
// debug-relevant images while keeping the bridge from choking on outliers.
export const BINARY_CAPTURE_SIZE_CAP = 5 * 1024 * 1024;

const readBlobAsText = (blob: Blob): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });

const readBlobAsBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      // FileReader.readAsDataURL returns "data:<mime>;base64,<payload>".
      // We only want the base64 payload.
      const dataUrl = reader.result as string;
      resolve(dataUrl.substring(dataUrl.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });

export const getResponseBody = async (
  request: XMLHttpRequest,
): Promise<ResponseBody> => {
  const responseType = request.responseType;

  // Response type is empty in certain cases, like when using axios.
  if (responseType === '' || responseType === 'text') {
    return request.responseText as string;
  }

  if (responseType === 'blob') {
    const contentType = request.getResponseHeader('Content-Type') || '';

    // SVG is image/svg+xml but it's text content — keep it on the text
    // path so the panel can show source in the Raw view without base64
    // round-tripping.
    if (
      contentType.startsWith('text/') ||
      isJsonContentType(contentType) ||
      contentType.startsWith('image/svg+xml')
    ) {
      return readBlobAsText(request.response);
    }

    if (contentType.startsWith('image/')) {
      const blob = request.response as Blob;
      if (blob.size > BINARY_CAPTURE_SIZE_CAP) {
        return { kind: 'binary-too-large', size: blob.size };
      }
      return { kind: 'binary', base64: await readBlobAsBase64(blob) };
    }
  }

  if (responseType === 'json') {
    return safeStringify(request.response);
  }

  return null;
};

export const getInitiatorFromStack = (): {
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
      if (isJsonContentType(contentType)) {
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
