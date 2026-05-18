import type {
  XHRPostData,
  RequestPostData,
  RequestTextPostData,
  RequestBinaryPostData,
  RequestFormDataPostData,
  Initiator,
  InitiatorStackFrame,
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
      isJsonContentType(contentType)
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

const STACK_PREVIEW_FRAME_LIMIT = 8;
const INITIATOR_STACK_FRAME_OFFSET = 3;

const parseStackLocation = (
  location: string,
): Pick<InitiatorStackFrame, 'url' | 'lineNumber' | 'columnNumber'> | null => {
  const match = location.match(/^(.*):(\d+):(\d+)$/);

  if (!match) {
    return null;
  }

  return {
    url: match[1],
    lineNumber: Number.parseInt(match[2], 10),
    columnNumber: Number.parseInt(match[3], 10),
  };
};

const normalizeFunctionName = (functionName?: string) => {
  const trimmedFunctionName = functionName?.trim();

  return trimmedFunctionName &&
    trimmedFunctionName !== '<anonymous>' &&
    trimmedFunctionName !== 'anonymous' &&
    trimmedFunctionName !== '<unknown>'
    ? trimmedFunctionName
    : undefined;
};

const parseStackFrame = (line: string): InitiatorStackFrame | null => {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return null;
  }

  let functionName: string | undefined;
  let location: string | undefined;

  const v8FunctionFrame = trimmedLine.match(/^at\s+(.*?)\s+\((.*)\)$/);
  if (v8FunctionFrame) {
    functionName = v8FunctionFrame[1];
    location = v8FunctionFrame[2];
  } else {
    const v8LocationFrame = trimmedLine.match(/^at\s+(.*)$/);
    const jscFrame = trimmedLine.match(/^(.*?)@(.*)$/);

    if (v8LocationFrame) {
      location = v8LocationFrame[1];
    } else if (jscFrame) {
      functionName = jscFrame[1];
      location = jscFrame[2];
    }
  }

  if (!location) {
    return null;
  }

  const parsedLocation = parseStackLocation(location);
  if (!parsedLocation) {
    return null;
  }

  return {
    functionName: normalizeFunctionName(functionName),
    ...parsedLocation,
  };
};

const toGeneratedStackFrame = (
  frame: InitiatorStackFrame,
): InitiatorStackFrame => ({
  functionName: frame.functionName,
  generatedUrl: frame.url,
  generatedLineNumber: frame.lineNumber,
  generatedColumnNumber: frame.columnNumber,
});

const getGeneratedFrameLocation = (frame: InitiatorStackFrame) => ({
  url: frame.generatedUrl ?? frame.url,
  lineNumber: frame.generatedLineNumber ?? frame.lineNumber,
  columnNumber: frame.generatedColumnNumber ?? frame.columnNumber,
});

const canSymbolicateStack = (stack?: InitiatorStackFrame[]) =>
  stack?.some((frame) =>
    getGeneratedFrameLocation(frame).url?.startsWith('http'),
  ) ?? false;

const getStackPreview = (frames: InitiatorStackFrame[]) => {
  // The first frames are this helper, the HTTP inspector callback and the XHR
  // wrapper. The caller starts after that fixed interception boundary.
  const callerFrames = frames.slice(INITIATOR_STACK_FRAME_OFFSET);

  return (callerFrames.length > 0 ? callerFrames : frames).slice(
    0,
    STACK_PREVIEW_FRAME_LIMIT,
  );
};

export const getInitiatorFromStack = (): Initiator => {
  try {
    const stack = new Error().stack;
    if (!stack) {
      return { type: 'other' };
    }

    const parsedFrames = stack
      .split('\n')
      .map(parseStackFrame)
      .filter((frame): frame is InitiatorStackFrame => frame !== null);

    const stackPreview = getStackPreview(parsedFrames);
    const initiatorFrame = stackPreview[0];
    const generatedStackPreview = stackPreview.map(toGeneratedStackFrame);

    if (initiatorFrame?.url) {
      return {
        type: 'script',
        functionName: initiatorFrame.functionName,
        generatedUrl: initiatorFrame.url,
        generatedLineNumber: initiatorFrame.lineNumber,
        generatedColumnNumber: initiatorFrame.columnNumber,
        stack: generatedStackPreview,
        symbolicationStatus: canSymbolicateStack(generatedStackPreview)
          ? 'pending'
          : 'unavailable',
      };
    }

    if (parsedFrames.length > 0) {
      const fallbackStack = stackPreview.map(toGeneratedStackFrame);

      return {
        type: 'other',
        stack: fallbackStack,
        symbolicationStatus: canSymbolicateStack(fallbackStack)
          ? 'pending'
          : 'unavailable',
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
