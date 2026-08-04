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
  isFetchAbortError,
  normalizeFetchRequest,
} from './fetch-utils';
import { captureResponseBodyFromArrayBuffer } from './response-body-utils';
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
type ExpoFetchModule = { fetch: typeof globalThis.fetch };

let callbacks: FetchInterceptorCallbacks | null = null;
let expoFetchModule: ExpoFetchModule | null = null;
let originalExpoFetch: typeof globalThis.fetch | null = null;
let wrapper: typeof globalThis.fetch | null = null;
let originalGlobalFetch: typeof globalThis.fetch | null = null;
let reconciliationTimer: ReturnType<typeof setTimeout> | null = null;

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

const emitFailed = (requestId: string, error: unknown, canceled: boolean) => {
  try {
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
  } catch {
    // Instrumentation must never affect application fetch behavior.
  }
};

const emitCompleted = (
  requestId: string,
  sendTime: number,
  responseReceivedAt: number,
  size: number | null,
) => {
  try {
    callbacks?.onRequestCompleted?.({
      requestId,
      timestamp: Date.now(),
      duration: Date.now() - sendTime,
      size,
      ttfb: responseReceivedAt - sendTime,
      source: 'expo',
    });
  } catch {
    // Instrumentation must never affect application fetch behavior.
  }
};

const captureCloneBody = async (
  requestId: string,
  clone: Response,
  contentType: string,
  contentLength: number | undefined,
) => {
  const reader = clone.body?.getReader();
  if (!reader) {
    callbacks?.onResponseBody?.(
      requestId,
      await captureFetchResponseBodyFromBytes(new Uint8Array(), contentType),
    );
    return 0;
  }

  const throttle = createProgressThrottler();
  const chunks: Uint8Array[] = [];
  const textLike = isTextLikeContentType(contentType);
  let captureBinary = !textLike;
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    loaded += value.byteLength;
    if (textLike || captureBinary) chunks.push(value);
    if (!textLike && captureBinary && loaded > BINARY_CAPTURE_SIZE_CAP) {
      chunks.length = 0;
      captureBinary = false;
    }
    if (throttle(Date.now())) {
      callbacks?.onRequestProgress?.({
        requestId,
        timestamp: Date.now(),
        loaded,
        total: contentLength ?? 0,
        lengthComputable: contentLength !== undefined && contentLength > 0,
        source: 'expo',
      });
    }
  }

  if (loaded > 0 || contentLength !== undefined) {
    callbacks?.onRequestProgress?.({
      requestId,
      timestamp: Date.now(),
      loaded,
      total: contentLength ?? 0,
      lengthComputable: contentLength !== undefined && contentLength > 0,
      source: 'expo',
    });
  }
  callbacks?.onResponseBody?.(
    requestId,
    captureBinary || textLike
      ? await captureFetchResponseBodyFromBytes(
          concatChunks(chunks, loaded),
          contentType,
        )
      : { kind: 'binary-too-large', size: loaded },
  );
  return loaded;
};

const decorateConsumedBody = (
  requestId: string,
  response: Response,
  contentType: string,
) => {
  let captured = false;
  const captureOnce = (
    capture: () => Promise<HttpEventMap['response-body']['body']>,
  ) => {
    if (captured) return;
    captured = true;
    void capture()
      .then((body) => callbacks?.onResponseBody?.(requestId, body))
      .catch(() => undefined);
  };

  try {
    const originalText = response.text;
    if (typeof originalText === 'function') {
      response.text = function () {
        const result = originalText.call(this);
        void result.then(
          (value) => captureOnce(async () => value),
          () => undefined,
        );
        return result;
      };
    }
  } catch {
    // Some Response implementations may not permit instance decoration.
  }

  try {
    const originalArrayBuffer = response.arrayBuffer;
    if (typeof originalArrayBuffer === 'function') {
      response.arrayBuffer = function () {
        const result = originalArrayBuffer.call(this);
        void result.then(
          (value) =>
            captureOnce(() =>
              captureResponseBodyFromArrayBuffer(value, contentType),
            ),
          () => undefined,
        );
        return result;
      };
    }
  } catch {
    // See text() above.
  }
};

const observeResponse = (
  requestId: string,
  sendTime: number,
  response: Response,
) => {
  const responseReceivedAt = Date.now();
  let contentLength: number | undefined;
  let contentType = '';
  try {
    contentLength = getFetchContentLength(response);
    contentType = getFetchContentType(response);
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
  } catch {
    // A non-standard response can throw while exposing metadata. It is still a
    // successful application fetch, so finish it without a failure event.
    try {
      callbacks?.onResponseBody?.(requestId, null);
    } catch {
      // Keep observation fail-open.
    }
    emitCompleted(requestId, sendTime, responseReceivedAt, null);
    return;
  }

  try {
    const clone = response.clone();
    void captureCloneBody(requestId, clone, contentType, contentLength).then(
      (loaded) =>
        emitCompleted(
          requestId,
          sendTime,
          responseReceivedAt,
          contentLength ?? loaded,
        ),
      () => {
        try {
          callbacks?.onResponseBody?.(requestId, null);
        } catch {
          // Keep observation fail-open.
        }
        emitCompleted(
          requestId,
          sendTime,
          responseReceivedAt,
          contentLength ?? null,
        );
      },
    );
  } catch {
    // SDK 54–55: complete the request now, and only observe a primitive body
    // consumer if application code uses one later.
    decorateConsumedBody(requestId, response, contentType);
    emitCompleted(
      requestId,
      sendTime,
      responseReceivedAt,
      contentLength ?? null,
    );
  }
};

const reconcileGlobalFetch = () => {
  if (!originalExpoFetch || !wrapper) return;
  if (globalThis.fetch === originalExpoFetch) {
    originalGlobalFetch ??= originalExpoFetch;
    globalThis.fetch = wrapper;
  } else if (globalThis.fetch === wrapper) {
    // Expo may install a lazy global getter only after the private export was
    // patched. In that case it resolves directly to our wrapper, but the
    // restoration target is still Expo's original private implementation.
    originalGlobalFetch ??= originalExpoFetch;
  }
};

const createWrapper = (fetchFn: typeof globalThis.fetch) =>
  async function (this: unknown, ...args: FetchArgs) {
    const sendTime = Date.now();
    const requestId = createRequestId();
    let normalizedRequest: ReturnType<typeof normalizeFetchRequest> | null =
      null;
    try {
      normalizedRequest = normalizeFetchRequest(args[0], args[1] ?? {});
      callbacks?.onRequestSent?.({
        requestId,
        timestamp: sendTime,
        request: normalizedRequest,
        initiator: getInitiatorFromStack(),
        type: 'Fetch',
        source: 'expo',
      });
    } catch {
      // Request normalization and event delivery are best-effort only.
    }

    try {
      const response = await fetchFn.apply(this, args);
      try {
        observeResponse(requestId, sendTime, response);
      } catch {
        // Return the original response even if observation itself fails.
      }
      return response;
    } catch (error) {
      emitFailed(
        requestId,
        error,
        isFetchAbortError(error) || normalizedRequest?.signal?.aborted === true,
      );
      throw error;
    }
  } as typeof globalThis.fetch;

export const FetchInterceptor = {
  setCallbacks(nextCallbacks: FetchInterceptorCallbacks | null) {
    callbacks = nextCallbacks;
  },

  isInterceptorEnabled(): boolean {
    return wrapper !== null;
  },

  enableInterception() {
    if (wrapper) return;
    expoFetchModule = getExpoFetchModule();
    if (!expoFetchModule || typeof expoFetchModule.fetch !== 'function') return;

    originalExpoFetch = expoFetchModule.fetch;
    // Expo SDK 56 can install global fetch lazily. Read it before patching the
    // private export so a getter that later resolves to our wrapper can still
    // be restored to Expo's original implementation.
    try {
      if (globalThis.fetch === originalExpoFetch) {
        originalGlobalFetch = originalExpoFetch;
      }
    } catch {
      // A hostile global getter must not prevent Expo interception.
    }
    wrapper = createWrapper(originalExpoFetch);
    expoFetchModule.fetch = wrapper;
    reconcileGlobalFetch();
    reconciliationTimer = setTimeout(() => {
      reconciliationTimer = null;
      reconcileGlobalFetch();
    }, 0);
  },

  disableInterception() {
    if (!wrapper) return;
    if (reconciliationTimer) clearTimeout(reconciliationTimer);
    reconciliationTimer = null;
    if (expoFetchModule?.fetch === wrapper && originalExpoFetch) {
      expoFetchModule.fetch = originalExpoFetch;
    }
    if (globalThis.fetch === wrapper && originalGlobalFetch) {
      globalThis.fetch = originalGlobalFetch;
    }
    expoFetchModule = null;
    originalExpoFetch = null;
    originalGlobalFetch = null;
    wrapper = null;
    callbacks = null;
  },
};
