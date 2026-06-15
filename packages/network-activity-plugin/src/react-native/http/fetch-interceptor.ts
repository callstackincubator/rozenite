import type { HttpEventMap } from '../../shared/http-events';
import { getInitiatorFromStack } from './http-utils';
import { getExpoFetchModule } from './get-expo-fetch-module';
import {
  BINARY_CAPTURE_SIZE_CAP,
  captureFetchResponseBodyFromBytes,
  createProgressThrottler,
  getFetchContentLength,
  getFetchContentType,
  getFetchResponseHeaders,
  normalizeFetchRequest,
  isFetchAbortError,
} from './fetch-utils';
import { isTextLikeContentType } from './response-body-utils';

type FetchInterceptorCallbacks = {
  onRequestSent?: (event: HttpEventMap['request-sent']) => void;
  onResponseReceived?: (event: HttpEventMap['response-received']) => void;
  onRequestCompleted?: (event: HttpEventMap['request-completed']) => void;
  onRequestFailed?: (event: HttpEventMap['request-failed']) => void;
  onRequestProgress?: (event: HttpEventMap['request-progress']) => void;
  onResponseBody?: (
    requestId: string,
    body: HttpEventMap['response-body']['body'],
  ) => void;
};

type FetchArgs = Parameters<typeof fetch>;

type ExpoFetchModule = {
  fetch: typeof globalThis.fetch;
};

let callbacks: FetchInterceptorCallbacks | null = null;
let isInterceptorEnabled = false;
let expoFetchModule: ExpoFetchModule | null = null;
let originalExpoFetch: typeof globalThis.fetch | null = null;

const createRequestId = () =>
  `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

const concatChunks = (chunks: Uint8Array[], totalBytes: number) => {
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
};

const emitRequestFailed = (
  requestId: string,
  error: unknown,
  canceled: boolean,
) => {
  callbacks?.onRequestFailed?.({
    requestId,
    timestamp: Date.now(),
    type: 'Fetch',
    error:
      error instanceof Error && error.message
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Failed',
    canceled,
    source: 'expo',
  });
};

const captureExpoFetchResponse = async (
  requestId: string,
  sendTime: number,
  response: Response,
) => {
  try {
    const responseReceivedAt = Date.now();
    const contentLength = getFetchContentLength(response);
    const contentType = getFetchContentType(response);
    const isTextLikeResponse = isTextLikeContentType(contentType);

    callbacks?.onResponseReceived?.({
      requestId,
      timestamp: responseReceivedAt,
      type: 'Fetch',
      response: {
        url: response.url,
        status: response.status,
        statusText: response.statusText,
        headers: getFetchResponseHeaders(response),
        contentType,
        size: contentLength ?? null,
        responseTime: responseReceivedAt,
      },
      source: 'expo',
    });

    const clone = response.clone();
    const reader = clone.body?.getReader();
    const progressThrottle = createProgressThrottler();
    const chunks: Uint8Array[] = [];
    let captureBinaryBody = !isTextLikeResponse;
    let loaded = 0;

    if (!reader) {
      const body = await captureFetchResponseBodyFromBytes(
        new Uint8Array(),
        contentType,
      );
      callbacks?.onResponseBody?.(requestId, body);
      callbacks?.onRequestCompleted?.({
        requestId,
        timestamp: Date.now(),
        duration: Date.now() - sendTime,
        size: 0,
        ttfb: responseReceivedAt - sendTime,
        source: 'expo',
      });
      return;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      loaded += value.byteLength;

      if (isTextLikeResponse || captureBinaryBody) {
        chunks.push(value);
      }

      if (!isTextLikeResponse && captureBinaryBody) {
        if (loaded > BINARY_CAPTURE_SIZE_CAP) {
          chunks.length = 0;
          captureBinaryBody = false;
        }
      }

      const timestamp = Date.now();
      if (progressThrottle(timestamp)) {
        callbacks?.onRequestProgress?.({
          requestId,
          timestamp,
          loaded,
          total: contentLength ?? 0,
          lengthComputable: contentLength !== undefined && contentLength > 0,
          source: 'expo',
        });
      }
    }

    const timestamp = Date.now();
    if (loaded > 0 || contentLength !== undefined) {
      callbacks?.onRequestProgress?.({
        requestId,
        timestamp,
        loaded,
        total: contentLength ?? 0,
        lengthComputable: contentLength !== undefined && contentLength > 0,
        source: 'expo',
      });
    }

    const body: HttpEventMap['response-body']['body'] =
      captureBinaryBody || isTextLikeResponse
      ? await captureFetchResponseBodyFromBytes(
          concatChunks(chunks, loaded),
          contentType,
        )
      : { kind: 'binary-too-large', size: loaded };
    callbacks?.onResponseBody?.(requestId, body);
    callbacks?.onRequestCompleted?.({
      requestId,
      timestamp: Date.now(),
      duration: Date.now() - sendTime,
      size: loaded,
      ttfb: responseReceivedAt - sendTime,
      source: 'expo',
    });
  } catch (error) {
    const canceled =
      isFetchAbortError(error) ||
      ((error instanceof Error && error.name === 'AbortError') ?? false);
    callbacks?.onResponseBody?.(requestId, null);
    emitRequestFailed(requestId, error, canceled);
  }
};

const patchExpoFetch = (fetchFn: typeof globalThis.fetch) => {
  if (!expoFetchModule) {
    return false;
  }

  if (isInterceptorEnabled) {
    return true;
  }

  originalExpoFetch = fetchFn;
  expoFetchModule.fetch = (async (...args: FetchArgs) => {
    const sendTime = Date.now();
    const requestId = createRequestId();
    const normalizedRequest = normalizeFetchRequest(args[0], args[1] ?? {});
    const initiator = getInitiatorFromStack();

    callbacks?.onRequestSent?.({
      requestId,
      timestamp: sendTime,
      request: normalizedRequest,
      initiator,
      type: 'Fetch',
      source: 'expo',
    });

    try {
      const response = await fetchFn(...args);
      void captureExpoFetchResponse(
        requestId,
        sendTime,
        response,
      );

      // The original response is returned to app code unchanged. The
      // interceptor works off a clone so it can record the response body
      // without consuming the app's copy.
      return response;
    } catch (error) {
      const signal = normalizedRequest.signal;
      const canceled =
        isFetchAbortError(error) || signal?.aborted === true;

      emitRequestFailed(requestId, error, canceled);
      throw error;
    }
  }) as typeof globalThis.fetch;

  isInterceptorEnabled = true;
  return true;
};

export const FetchInterceptor = {
  setCallbacks(nextCallbacks: FetchInterceptorCallbacks | null) {
    callbacks = nextCallbacks;
  },

  isInterceptorEnabled(): boolean {
    return isInterceptorEnabled;
  },

  enableInterception() {
    if (isInterceptorEnabled) {
      return;
    }

    expoFetchModule = getExpoFetchModule();
    if (!expoFetchModule) {
      return;
    }

    patchExpoFetch(expoFetchModule.fetch);
  },

  disableInterception() {
    if (!isInterceptorEnabled) {
      return;
    }

    if (expoFetchModule && originalExpoFetch) {
      expoFetchModule.fetch = originalExpoFetch;
    }

    expoFetchModule = null;
    originalExpoFetch = null;
    isInterceptorEnabled = false;
    callbacks = null;
  },
};
