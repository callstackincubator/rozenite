import type { ResponseBody, Initiator, InitiatorStackFrame } from '../../shared/client';
import { safeStringify } from '../../utils/safeStringify';
import { getStringSizeInBytes } from '../../utils/getStringSizeInBytes';
import { getContentType } from '../utils';
import { isJsonContentType } from '../../utils/getContentTypeMimeType';
import type { OverridesRegistry } from './overrides-registry';
import {
  captureResponseBodyFromArrayBuffer,
  captureResponseBodyFromBlob,
} from './response-body-utils';

export { BINARY_CAPTURE_SIZE_CAP } from './response-body-utils';

export const getResponseSize = (request: XMLHttpRequest): number | null => {
  try {
    const { responseType, response } = request;

    // Handle a case of 204 where no-content was sent.
    if (response === null) return 0;
    if (responseType === '' || responseType === 'text')
      return getStringSizeInBytes(request.responseText);
    if (responseType === 'json') return getStringSizeInBytes(safeStringify(response));
    if (responseType === 'blob') return response.size;
    if (responseType === 'arraybuffer') return response.byteLength;
    return 0;
  } catch {
    return null;
  }
};

export const getResponseBody = async (request: XMLHttpRequest): Promise<ResponseBody> => {
  const responseType = request.responseType;

  // Response type is empty in certain cases, like when using axios.
  if (responseType === '' || responseType === 'text') {
    return request.responseText as string;
  }

  if (responseType === 'blob') {
    const contentType = request.getResponseHeader('Content-Type') || '';
    return captureResponseBodyFromBlob(request.response as Blob, contentType);
  }

  if (responseType === 'arraybuffer') {
    return captureResponseBodyFromArrayBuffer(request.response as ArrayBuffer | null);
  }

  if (responseType === 'json') {
    // A response override sets `.response` directly to its raw body string
    // (see `setupRequestOverride`), so it is already the wire body — running
    // it through `safeStringify` again would double-encode it.
    return typeof request.response === 'string'
      ? request.response
      : safeStringify(request.response);
  }

  return null;
};

// Two frames sit between `new Error()` and the real caller: this helper, and
// the adapter function that calls it directly (the XHR hook's `send`, or the
// fetch hook's wrapper — both plain, non-async functions, so neither the
// engine nor a transform inserts anything in between).
const INITIATOR_STACK_FRAME_OFFSET = 2;
const STACK_PREVIEW_FRAME_LIMIT = 8;

const parseStackLocation = (
  location: string,
): Pick<InitiatorStackFrame, 'url' | 'lineNumber' | 'columnNumber'> | null => {
  const match = location.match(/^(.*):(\d+):(\d+)$/);
  if (!match) return null;
  return {
    url: match[1],
    lineNumber: Number.parseInt(match[2], 10),
    columnNumber: Number.parseInt(match[3], 10),
  };
};

const normalizeFunctionName = (functionName?: string) => {
  const trimmed = functionName?.trim();
  return trimmed && trimmed !== '<anonymous>' && trimmed !== 'anonymous' && trimmed !== '<unknown>'
    ? trimmed
    : undefined;
};

// Hermes (and V8) stack frames look like `at fn (file:line:col)` or
// `at file:line:col`.
const parseStackFrame = (line: string): InitiatorStackFrame | null => {
  const trimmedLine = line.trim();
  if (!trimmedLine) return null;

  const withFunction = trimmedLine.match(/^at\s+(.*?)\s+\((.*)\)$/);
  const withoutFunction = withFunction ? null : trimmedLine.match(/^at\s+(.*)$/);
  const location = withFunction?.[2] ?? withoutFunction?.[1];
  if (!location) return null;

  const parsedLocation = parseStackLocation(location);
  if (!parsedLocation) return null;

  return { functionName: normalizeFunctionName(withFunction?.[1]), ...parsedLocation };
};

const toGeneratedStackFrame = (frame: InitiatorStackFrame): InitiatorStackFrame => ({
  functionName: frame.functionName,
  generatedUrl: frame.url,
  generatedLineNumber: frame.lineNumber,
  generatedColumnNumber: frame.columnNumber,
});

const canSymbolicateStack = (stack: InitiatorStackFrame[]) =>
  stack.some((frame) => frame.generatedUrl?.startsWith('http'));

const getStackPreview = (frames: InitiatorStackFrame[]) => {
  const callerFrames = frames.slice(INITIATOR_STACK_FRAME_OFFSET);
  return (callerFrames.length > 0 ? callerFrames : frames).slice(0, STACK_PREVIEW_FRAME_LIMIT);
};

export const getInitiatorFromStack = (): Initiator => {
  try {
    const stack = new Error().stack;
    if (!stack) return { type: 'other' };

    const parsedFrames = stack
      .split('\n')
      .map(parseStackFrame)
      .filter((frame): frame is InitiatorStackFrame => frame !== null);

    const stackPreview = getStackPreview(parsedFrames).map(toGeneratedStackFrame);
    const initiatorFrame = stackPreview[0];
    const symbolicationStatus = canSymbolicateStack(stackPreview) ? 'pending' : 'unavailable';

    if (initiatorFrame?.generatedUrl) {
      return {
        type: 'script',
        functionName: initiatorFrame.functionName,
        generatedUrl: initiatorFrame.generatedUrl,
        generatedLineNumber: initiatorFrame.generatedLineNumber,
        generatedColumnNumber: initiatorFrame.generatedColumnNumber,
        stack: stackPreview,
        symbolicationStatus,
      };
    }

    if (stackPreview.length > 0) {
      return { type: 'other', stack: stackPreview, symbolicationStatus };
    }
  } catch {
    // Ignore stack parsing errors
  }

  return { type: 'other' };
};

/**
 * Applies override body and status to XMLHttpRequest objects. `url` is the
 * request URL as captured from `open()`'s own argument, not read off the XHR
 * instance, which is why it is passed in rather than read from `request`.
 */
export const setupRequestOverride = (
  overridesRegistry: OverridesRegistry,
  request: XMLHttpRequest,
  url: string,
): void => {
  const override = overridesRegistry.getOverrideForUrl(url);
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
