import type {
  XHRPostData,
  RequestPostData,
  RequestTextPostData,
  RequestBinaryPostData,
  RequestFormDataPostData,
  Initiator,
  InitiatorStackFrame,
} from '../../shared/client';
import symbolicateStackTrace from 'react-native/Libraries/Core/Devtools/symbolicateStackTrace';
import { safeStringify } from '../../utils/safeStringify';
import { getStringSizeInBytes } from '../../utils/getStringSizeInBytes';
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

const STACK_PREVIEW_FRAME_LIMIT = 8;

const INTERNAL_STACK_PATTERNS = [
  'getInitiatorFromStack',
  'http-utils',
  'http-inspector',
  'xhr-interceptor',
  'XHRInterceptor',
  'XMLHttpRequest',
  '@rozenite/network-activity-plugin',
  '/network-activity-plugin/',
];

const LOW_VALUE_SYMBOLICATED_FRAME_PATTERNS = [
  'InternalBytecode.js',
  '/node_modules/',
  'node_modules/',
  'react-native/Libraries/',
  '@react-native/',
  '@babel/runtime/',
  'metro-runtime/',
  'promise/setimmediate/',
  ...INTERNAL_STACK_PATTERNS,
];

type ReactNativeStackFrame = {
  methodName: string;
  file: string | null | undefined;
  lineNumber: number | null | undefined;
  column: number | null | undefined;
  collapse?: boolean;
};

type SymbolicatedStackTrace = {
  stack: ReadonlyArray<ReactNativeStackFrame>;
  codeFrame?: Initiator['codeFrame'];
};

export const shouldIgnoreNetworkActivityRequest = (url: string) => {
  try {
    return new URL(url).pathname === '/symbolicate';
  } catch {
    return url.includes('/symbolicate');
  }
};

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

const isInternalStackFrame = (frame: InitiatorStackFrame) => {
  const searchableFrame = [frame.functionName, frame.url, frame.generatedUrl]
    .filter(Boolean)
    .join(' ');

  return INTERNAL_STACK_PATTERNS.some((pattern) =>
    searchableFrame.includes(pattern),
  );
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

const isGeneratedBundleUrl = (url: string) =>
  /[^/]+\.bundle(?:[/?#]|$)/.test(url);

const getComparableSourcePath = (url?: string) =>
  url?.split(/[?#]/)[0].replace(/^file:\/\//, '');

const getCodeFrameForSourceFrame = (
  codeFrame: Initiator['codeFrame'] | undefined,
  sourceFrame: InitiatorStackFrame | undefined,
) => {
  const codeFramePath = getComparableSourcePath(codeFrame?.fileName);
  const sourcePath = getComparableSourcePath(sourceFrame?.url);

  if (!codeFrame || !codeFramePath || !sourcePath) {
    return null;
  }

  return codeFramePath.endsWith(sourcePath) ||
    sourcePath.endsWith(codeFramePath)
    ? codeFrame
    : null;
};

const canSymbolicateStack = (stack?: InitiatorStackFrame[]) =>
  stack?.some((frame) =>
    getGeneratedFrameLocation(frame).url?.startsWith('http'),
  ) ?? false;

const isUsefulSymbolicatedFrame = (frame: InitiatorStackFrame) => {
  if (!frame.url || frame.isCollapsed) {
    return false;
  }

  const searchableFrame = [frame.functionName, frame.url].join(' ');

  return !LOW_VALUE_SYMBOLICATED_FRAME_PATTERNS.some((pattern) =>
    searchableFrame.includes(pattern),
  );
};

const toReactNativeStackFrame = (
  frame: InitiatorStackFrame,
): ReactNativeStackFrame | null => {
  const generatedLocation = getGeneratedFrameLocation(frame);

  if (!generatedLocation.url) {
    return null;
  }

  return {
    methodName: frame.functionName ?? '<anonymous>',
    file: generatedLocation.url,
    lineNumber: generatedLocation.lineNumber,
    column: generatedLocation.columnNumber,
  };
};

const fromSymbolicatedStackFrame = (
  frame: ReactNativeStackFrame,
  generatedFrame: InitiatorStackFrame,
): InitiatorStackFrame => {
  const generatedLocation = getGeneratedFrameLocation(generatedFrame);
  const sourceUrl =
    frame.file &&
    frame.file !== generatedLocation.url &&
    !isGeneratedBundleUrl(frame.file)
      ? frame.file
      : undefined;

  return {
    functionName:
      normalizeFunctionName(frame.methodName) ?? generatedFrame.functionName,
    url: sourceUrl,
    lineNumber: sourceUrl ? (frame.lineNumber ?? undefined) : undefined,
    columnNumber: sourceUrl ? (frame.column ?? undefined) : undefined,
    generatedUrl: generatedLocation.url,
    generatedLineNumber: generatedLocation.lineNumber,
    generatedColumnNumber: generatedLocation.columnNumber,
    isCollapsed: frame.collapse,
  };
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

    const stackPreview = parsedFrames
      .filter((frame) => !isInternalStackFrame(frame))
      .slice(0, STACK_PREVIEW_FRAME_LIMIT);
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
      const fallbackStack = parsedFrames
        .slice(0, STACK_PREVIEW_FRAME_LIMIT)
        .map(toGeneratedStackFrame);

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

export const symbolicateInitiator = async (
  initiator: Initiator,
): Promise<Initiator | null> => {
  if (!canSymbolicateStack(initiator.stack)) {
    return null;
  }

  const generatedStackFrames =
    initiator.stack
      ?.map(toReactNativeStackFrame)
      .filter((frame): frame is ReactNativeStackFrame => frame !== null) ?? [];

  if (generatedStackFrames.length === 0) {
    return null;
  }

  try {
    const symbolicatedStackTrace = (await symbolicateStackTrace(
      generatedStackFrames,
    )) as SymbolicatedStackTrace;

    const symbolicatedStack = symbolicatedStackTrace.stack.map((frame, index) =>
      fromSymbolicatedStackFrame(frame, initiator.stack?.[index] ?? {}),
    );
    const sourceFrame =
      symbolicatedStack.find(isUsefulSymbolicatedFrame) ??
      symbolicatedStack.find((frame) => frame.url && !frame.isCollapsed) ??
      symbolicatedStack[0];
    const hasSourceMappedFrame = symbolicatedStack.some((frame) => frame.url);

    return {
      ...initiator,
      type: sourceFrame?.url ? 'script' : initiator.type,
      functionName: sourceFrame?.functionName,
      url: sourceFrame?.url,
      lineNumber: sourceFrame?.lineNumber,
      columnNumber: sourceFrame?.columnNumber,
      generatedUrl: sourceFrame?.generatedUrl ?? initiator.generatedUrl,
      generatedLineNumber:
        sourceFrame?.generatedLineNumber ?? initiator.generatedLineNumber,
      generatedColumnNumber:
        sourceFrame?.generatedColumnNumber ?? initiator.generatedColumnNumber,
      stack: symbolicatedStack,
      codeFrame: getCodeFrameForSourceFrame(
        symbolicatedStackTrace.codeFrame,
        sourceFrame,
      ),
      symbolicationStatus: hasSourceMappedFrame ? 'complete' : 'unavailable',
      symbolicationError: undefined,
    };
  } catch (error) {
    return {
      ...initiator,
      symbolicationStatus: 'failed',
      symbolicationError:
        error instanceof Error ? error.message : 'Unable to symbolicate stack',
    };
  }
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
