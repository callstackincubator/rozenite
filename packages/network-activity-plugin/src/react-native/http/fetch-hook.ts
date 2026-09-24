import type { NetworkEventSource } from '../../shared/client';
import type { Recorder, RecorderHandle } from './recorder';
import { getInitiatorFromStack } from './http-utils';
import { getExpoFetchModule } from './get-expo-fetch-module';
import { getNitroFetchFunction } from '../nitro-fetch/get-nitro-module';
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
import { isTextLikeContentType } from './response-body-utils';
import { beginActiveFetchCall, endActiveFetchCall } from './fetch-dedupe';

/**
 * Generic fetch wrapper for every fetch implementation that does not send an
 * XHR: Expo's `expo/fetch` and, when an app installs it as the global,
 * `react-native-nitro-fetch` would qualify too, but nitro traffic is
 * recorded from its own `NetworkInspector` instead (see
 * `nitro-fetch/nitro-network-inspector.ts`) — this wrapper is never
 * installed over it.
 *
 * A single module-level "active fetch" marker (`fetch-dedupe.ts`) is set
 * synchronously around the call to the original `fetch`. React Native's own
 * `fetch` (`whatwg-fetch`) and Axios both send an XHR synchronously inside
 * that window; the XHR hook flips the marker, and this wrapper then records
 * nothing for that call — the XHR hook already did.
 */

type FetchArgs = Parameters<typeof fetch>;

const concatChunks = (chunks: Uint8Array[], totalBytes: number): Uint8Array => {
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

const observeResponseBody = async (
  handle: RecorderHandle,
  clone: Response,
  contentType: string,
  contentLength: number | undefined,
): Promise<number> => {
  const reader = clone.body?.getReader();
  if (!reader) {
    handle.end({
      size: contentLength ?? 0,
      body: await captureFetchResponseBodyFromBytes(new Uint8Array(), contentType),
    });
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
      handle.progress(loaded, contentLength ?? 0, contentLength !== undefined && contentLength > 0);
    }
  }

  if (loaded > 0 || contentLength !== undefined) {
    handle.progress(loaded, contentLength ?? 0, contentLength !== undefined && contentLength > 0);
  }

  const body =
    captureBinary || textLike
      ? await captureFetchResponseBodyFromBytes(concatChunks(chunks, loaded), contentType)
      : ({ kind: 'binary-too-large', size: loaded } as const);

  handle.end({ size: contentLength ?? loaded, body });
  return loaded;
};

const observeResponse = (handle: RecorderHandle, response: Response): void => {
  let contentLength: number | undefined;
  let contentType = '';
  try {
    contentLength = getFetchContentLength(response);
    contentType = getFetchContentType(response);
    handle.headers({
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      headers: getFetchResponseHeaders(response),
      contentType,
      size: contentLength ?? null,
    });
  } catch {
    // A non-standard response can throw while exposing metadata. It is still
    // a successful application fetch, so finish it without a body.
    handle.end({ size: null, body: null });
    return;
  }

  try {
    const clone = response.clone();
    void observeResponseBody(handle, clone, contentType, contentLength).catch(() => {
      handle.end({ size: contentLength ?? null, body: null });
    });
  } catch {
    // `clone()` is unavailable or throws (Expo SDK 54–55): complete without a
    // body rather than decorating the response's body-consuming methods.
    handle.end({ size: contentLength ?? null, body: null });
  }
};

export const wrapFetch = (
  original: typeof fetch,
  source: NetworkEventSource,
  getRecorder: () => Recorder | null,
): typeof fetch => {
  // Anonymous on purpose: some scenarios report `fetch.name` to distinguish a
  // wrapped implementation from the original, and the original wrapper here
  // was likewise anonymous.
  return async function (this: unknown, ...args: FetchArgs) {
    const marker = beginActiveFetchCall();
    let pending: ReturnType<typeof fetch>;
    try {
      pending = original.apply(this, args);
    } finally {
      endActiveFetchCall(marker);
    }

    const recorder = getRecorder();
    if (!recorder || marker.sentXhr) {
      return pending;
    }

    let handle: RecorderHandle | null = null;
    let signal: AbortSignal | undefined;
    try {
      const normalizedRequest = normalizeFetchRequest(args[0], args[1] ?? {});
      signal = normalizedRequest.signal;
      handle = recorder.begin({
        url: normalizedRequest.url,
        method: normalizedRequest.method,
        headers: normalizedRequest.headers,
        postData: normalizedRequest.postData,
        type: 'Fetch',
        source,
        // +1: this wrapper is an `async function` — see the comment on
        // `INITIATOR_STACK_FRAME_OFFSET` in `http-utils.ts`.
        initiator: getInitiatorFromStack(1),
        requestSignal: signal,
      });
    } catch {
      // Request normalization and event delivery are best-effort only.
    }

    try {
      const response = await pending;
      if (handle) {
        try {
          observeResponse(handle, response);
        } catch {
          // Return the original response even if observation itself fails.
        }
      }
      return response;
    } catch (error) {
      handle?.fail(
        error instanceof Error && error.message
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Failed',
        isFetchAbortError(error) || signal?.aborted === true,
      );
      throw error;
    }
  } as typeof fetch;
};

type FetchHookState = {
  expoModule: { fetch: typeof fetch } | null;
  originalExpoFetch: typeof fetch | null;
  expoWrapped: typeof fetch | null;
  globalOriginal: typeof fetch | null;
  globalWrapped: typeof fetch | null;
};

let state: FetchHookState | null = null;
let activeRecorder: Recorder | null = null;

const getRecorder = () => activeRecorder;

export const isFetchHookEnabled = (): boolean => state !== null;

export const enableFetchHook = (recorder: Recorder): void => {
  if (state) return;
  activeRecorder = recorder;

  const next: FetchHookState = {
    expoModule: null,
    originalExpoFetch: null,
    expoWrapped: null,
    globalOriginal: null,
    globalWrapped: null,
  };

  const expoModule = getExpoFetchModule();
  if (expoModule && typeof expoModule.fetch === 'function') {
    next.expoModule = expoModule;
    next.originalExpoFetch = expoModule.fetch;
    next.expoWrapped = wrapFetch(next.originalExpoFetch, 'expo', getRecorder);
    expoModule.fetch = next.expoWrapped;
  }

  try {
    const currentGlobalFetch = globalThis.fetch;
    const nitroFetch = getNitroFetchFunction();
    const isNitroInstalledGlobally = nitroFetch !== null && currentGlobalFetch === nitroFetch;

    if (!isNitroInstalledGlobally) {
      next.globalOriginal = currentGlobalFetch;
      if (
        next.originalExpoFetch &&
        currentGlobalFetch === next.originalExpoFetch &&
        next.expoWrapped
      ) {
        // Expo already made its implementation the global; keep the label 'expo'.
        next.globalWrapped = next.expoWrapped;
      } else {
        next.globalWrapped = wrapFetch(currentGlobalFetch, 'builtin', getRecorder);
      }
      globalThis.fetch = next.globalWrapped;
    }
  } catch {
    // A hostile global getter must not prevent Expo interception.
  }

  state = next;
};

export const disableFetchHook = (): void => {
  if (!state) return;
  const { expoModule, originalExpoFetch, expoWrapped, globalOriginal, globalWrapped } = state;

  if (expoModule && originalExpoFetch && expoModule.fetch === expoWrapped) {
    expoModule.fetch = originalExpoFetch;
  }
  if (globalWrapped && globalOriginal && globalThis.fetch === globalWrapped) {
    globalThis.fetch = globalOriginal;
  }

  state = null;
  activeRecorder = null;
};
