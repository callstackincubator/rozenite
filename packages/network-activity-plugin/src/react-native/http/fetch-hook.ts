import type { Recorder, RecorderHandle } from './recorder';
import { getInitiatorFromStack } from './http-utils';
import {
  BINARY_CAPTURE_SIZE_CAP,
  captureResponseBodyFromBytes,
  createProgressThrottler,
  getFetchContentLength,
  getFetchContentType,
  isFetchAbortError,
  isTextLikeContentType,
  normalizeFetchRequest,
  normalizeHeaders,
} from './response-body-utils';

/**
 * The one generic fetch wrapper, covering every fetch implementation that
 * doesn't send an XHR: Expo's `expo/fetch`, and — only when the global is,
 * or lazily resolves to, that same implementation — the global `fetch`. Per
 * ADR 0001 decision 2, RN's own polyfill (and any application wrapper
 * around it) and `react-native-nitro-fetch`'s `fetch` are never wrapped:
 * the XHR hook and nitro's `NetworkInspector` already record that traffic,
 * and both can send their request asynchronously, after the marker window
 * below has already closed, which would double-record it.
 */

type FetchArgs = Parameters<typeof fetch>;

// A single module-level "active fetch call" marker, set synchronously around
// the call to the original `fetch`. `whatwg-fetch` (RN's own `fetch`, and
// Axios by default) sends its XMLHttpRequest synchronously inside that
// window; the XHR hook's patched `send` flips the marker, and a call that
// sent an XHR is already recorded, so this wrapper records nothing for it.
// `previous` makes markers stack correctly for a fetch call nested inside
// another fetch call's synchronous phase.
type ActiveFetchMarker = { sentXhr: boolean; previous: ActiveFetchMarker | null };
let activeFetchCall: ActiveFetchMarker | null = null;

export const markActiveFetchCallSentXhr = (): void => {
  if (activeFetchCall) activeFetchCall.sentXhr = true;
};

const concatChunks = (chunks: Uint8Array[], totalBytes: number): Uint8Array => {
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

const finishWithoutBody = (handle: RecorderHandle, size: number | null) =>
  handle.end({ size, body: null });

const observeResponseBody = async (
  handle: RecorderHandle,
  clone: Response,
  contentType: string,
  contentLength: number | undefined,
): Promise<void> => {
  if (contentType === 'text/event-stream') {
    // An SSE stream never ends on its own; consuming it here would hold the
    // connection open indefinitely for no benefit — nothing observes a
    // fetch-based SSE body today.
    handle.end({ size: contentLength ?? null });
    return;
  }

  const reader = clone.body?.getReader();
  if (!reader) {
    handle.end({
      size: contentLength ?? 0,
      body: await captureResponseBodyFromBytes(new Uint8Array(), contentType),
    });
    return;
  }

  const throttle = createProgressThrottler();
  const chunks: Uint8Array[] = [];
  let captured = 0;
  let loaded = 0;
  let capped = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    loaded += value.byteLength;

    if (!capped) {
      chunks.push(value);
      captured += value.byteLength;
      if (captured > BINARY_CAPTURE_SIZE_CAP) {
        capped = true;
        await reader.cancel().catch(() => undefined);
      }
    }

    if (throttle(Date.now())) {
      handle.progress(loaded, contentLength ?? 0, contentLength !== undefined && contentLength > 0);
    }
  }

  if (loaded > 0 || contentLength !== undefined) {
    handle.progress(loaded, contentLength ?? 0, contentLength !== undefined && contentLength > 0);
  }

  const body =
    capped && !isTextLikeContentType(contentType)
      ? ({ kind: 'binary-too-large', size: loaded } as const)
      : await captureResponseBodyFromBytes(concatChunks(chunks, captured), contentType);

  handle.end({ size: contentLength ?? loaded, body });
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
      headers: normalizeHeaders(response.headers),
      contentType,
      size: contentLength ?? null,
    });
  } catch {
    // A non-standard response can throw while exposing metadata. It is still
    // a successful application fetch, so finish it without a body.
    finishWithoutBody(handle, null);
    return;
  }

  let clone: Response;
  try {
    clone = response.clone();
  } catch {
    // `clone()` is unavailable or throws (Expo SDK 54-55): complete without a
    // body rather than decorating the response's body-consuming methods.
    finishWithoutBody(handle, contentLength ?? null);
    return;
  }

  void observeResponseBody(handle, clone, contentType, contentLength).catch(() =>
    finishWithoutBody(handle, contentLength ?? null),
  );
};

/** @internal exported for testing only */
export const wrapFetch = (original: typeof fetch, getRecorder: () => Recorder | null) => {
  let alive = true;

  // A plain function, not `async`: an `async function`'s transpilation
  // (Hermes and Babel's regenerator-based helper alike) inserts a
  // synchronous runtime frame between the function and its caller, which
  // would need its own initiator-stack offset. Returning the promise chain
  // instead keeps this the same shape as the XHR hook's synchronous `send`.
  const fn = function (this: unknown, ...args: FetchArgs) {
    if (!alive) return original.apply(this, args);

    const marker: ActiveFetchMarker = { sentXhr: false, previous: activeFetchCall };
    activeFetchCall = marker;
    let pending: ReturnType<typeof fetch>;
    try {
      pending = original.apply(this, args);
    } finally {
      activeFetchCall = activeFetchCall === marker ? marker.previous : activeFetchCall;
    }

    const recorder = getRecorder();
    if (!recorder || marker.sentXhr) return pending;

    let handle: RecorderHandle | null = null;
    let signal: AbortSignal | undefined;
    try {
      const normalized = normalizeFetchRequest(args[0], args[1] ?? {});
      signal = normalized.signal;
      handle = recorder.begin({
        url: normalized.url,
        method: normalized.method,
        headers: normalized.headers,
        postData: normalized.postData,
        type: 'Fetch',
        source: 'expo',
        initiator: getInitiatorFromStack(),
      });
    } catch {
      // Request normalization and event delivery are best-effort only.
    }

    return pending.then(
      (response) => {
        if (handle) {
          try {
            observeResponse(handle, response);
          } catch {
            // Return the original response even if observation itself fails.
          }
        }
        return response;
      },
      (error: unknown) => {
        handle?.fail(
          error instanceof Error && error.message
            ? error.message
            : typeof error === 'string'
              ? error
              : 'Failed',
          isFetchAbortError(error) || signal?.aborted === true,
        );
        throw error;
      },
    );
  } as typeof fetch;

  return { fn, disable: () => (alive = false) };
};

const patch = (
  obj: Record<string, typeof fetch>,
  key: string,
  wrapped: typeof fetch,
): (() => void) => {
  const original = obj[key];
  obj[key] = wrapped;
  return () => {
    if (obj[key] === wrapped) obj[key] = original;
  };
};

const getExpoFetchModule = (): { fetch: typeof fetch } | null => {
  try {
    // `expo/fetch` is a getter-only public facade. Patching the writable
    // implementation export keeps normal ESM imports live without trying to
    // assign through that facade.
    return require('expo/src/winter/fetch/fetch') as { fetch: typeof fetch };
  } catch {
    return null;
  }
};

const getNitroFetch = (): typeof fetch | null => {
  try {
    return (require('react-native-nitro-fetch') as { fetch: typeof fetch }).fetch;
  } catch {
    return null;
  }
};

let installation: { restores: (() => void)[]; disables: (() => void)[] } | null = null;
let activeRecorder: Recorder | null = null;
const getRecorder = () => activeRecorder;

export const isFetchHookEnabled = (): boolean => installation !== null;

export const enableFetchHook = (recorder: Recorder): void => {
  if (installation) return;
  activeRecorder = recorder;

  const next: { restores: (() => void)[]; disables: (() => void)[] } = {
    restores: [],
    disables: [],
  };
  const expoModule = getExpoFetchModule();

  if (expoModule && typeof expoModule.fetch === 'function') {
    const originalExpoFetch = expoModule.fetch;
    // Read before patching: Expo's global `fetch` alias can resolve to
    // whatever this private export currently holds, so reading it first
    // tells us whether the global already is Expo's implementation, rather
    // than mistaking our own wrapper for it a moment later.
    const originalGlobalFetch = globalThis.fetch;
    const { fn: expoWrapped, disable } = wrapFetch(originalExpoFetch, getRecorder);

    next.restores.push(
      patch(expoModule as unknown as Record<string, typeof fetch>, 'fetch', expoWrapped),
    );
    next.disables.push(disable);

    const nitroFetch = getNitroFetch();
    const globalIsNitro = nitroFetch !== null && originalGlobalFetch === nitroFetch;
    const globalIsExpo = originalGlobalFetch === originalExpoFetch;

    if (!globalIsNitro && globalIsExpo) {
      try {
        next.restores.push(
          patch(globalThis as unknown as Record<string, typeof fetch>, 'fetch', expoWrapped),
        );
      } catch {
        // A hostile global getter must not prevent Expo interception.
      }
    }
    // Otherwise the global is RN's own polyfill, an application wrapper
    // around it, or nitro's fetch — never wrapped. If Expo later installs a
    // getter aliasing the global to this same private export, it resolves
    // to `expoWrapped` on its own, with nothing further needed here.
  }

  installation = next;
};

export const disableFetchHook = (): void => {
  if (!installation) return;
  installation.restores.forEach((restore) => restore());
  installation.disables.forEach((disable) => disable());
  installation = null;
  activeRecorder = null;
};
