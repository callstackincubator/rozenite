/* eslint-disable prefer-rest-params */
import type { HttpMethod, HttpHeaders, XHRPostData } from '../../shared/client';
import type { Recorder } from './recorder';
import {
  getInitiatorFromStack,
  getResponseBody,
  getResponseSize,
  setupRequestOverride,
} from './http-utils';
import { getRequestBody } from './request-utils';
import { applyReactNativeResponseHeadersLogic } from '../../utils/applyReactNativeResponseHeadersLogic';
import { getContentType } from '../utils';
import { overridesRegistry } from './overrides-registry';
import { markActiveFetchCallSentXhr } from './fetch-hook';

/**
 * The primary HTTP capture path for the built-in stack. Patches
 * `XMLHttpRequest.prototype`'s `open`, `setRequestHeader` and `send`, keeping
 * per-instance state in a `WeakMap` populated from each method's own
 * arguments — never from RN's underscore-prefixed instance fields.
 *
 * This also covers Axios (XHR by default), `react-native-sse` (built on
 * XHR — see `getRequestIdForXhr` below) and React Native's own `fetch`,
 * which is `whatwg-fetch` constructing and sending an XHR synchronously.
 */

const XHRCtor = global.XMLHttpRequest || window.XMLHttpRequest;

type PendingXhrMeta = { method: HttpMethod; url: string; headers: HttpHeaders };

const pendingMeta = new WeakMap<XMLHttpRequest, PendingXhrMeta>();
const requestIdByXhr = new WeakMap<XMLHttpRequest, string>();

/** Used by the SSE inspector instead of a private field written onto the XHR. */
export const getRequestIdForXhr = (xhr: XMLHttpRequest): string | null =>
  requestIdByXhr.get(xhr) ?? null;

type XhrMethods = {
  open: typeof XHRCtor.prototype.open;
  send: typeof XHRCtor.prototype.send;
  setRequestHeader: typeof XHRCtor.prototype.setRequestHeader;
};

let installed: { previous: XhrMethods; patched: XhrMethods; retire: () => void } | null = null;
let activeRecorder: Recorder | null = null;

export const isXhrHookEnabled = (): boolean => installed !== null;

export const enableXhrHook = (recorder: Recorder): void => {
  if (installed) return;
  activeRecorder = recorder;
  // Each installation carries its own flag: a patch left inside another
  // library's chain after `disable()` must stay inert on a later `enable()`.
  let alive = true;

  const previous: XhrMethods = {
    open: XHRCtor.prototype.open,
    send: XHRCtor.prototype.send,
    setRequestHeader: XHRCtor.prototype.setRequestHeader,
  };
  const originalOpen = previous.open;
  const originalSend = previous.send;
  const originalSetRequestHeader = previous.setRequestHeader;

  XHRCtor.prototype.open = function (this: XMLHttpRequest, method: string, url: string) {
    pendingMeta.set(this, { method: method.toUpperCase() as HttpMethod, url, headers: {} });
    // @ts-expect-error - forwarding the original arguments
    return originalOpen.apply(this, arguments);
  };

  XHRCtor.prototype.setRequestHeader = function (
    this: XMLHttpRequest,
    header: string,
    value: unknown,
  ) {
    const meta = pendingMeta.get(this);
    if (meta) {
      // RN's own `setRequestHeader` lowercases the name, stringifies the
      // value, and *overwrites* any existing value for that name — it does
      // not accumulate repeats into an array (see `XMLHttpRequest.js:521`,
      // `this._headers[header.toLowerCase()] = String(value)`). Match that
      // exactly; this is not the same merge `appendHeader` does for a
      // `Headers` object's or nitro's repeatable header lists.
      meta.headers[header.toLowerCase()] = String(value);
    }
    // @ts-expect-error - forwarding the original arguments
    return originalSetRequestHeader.apply(this, arguments);
  };

  XHRCtor.prototype.send = function (this: XMLHttpRequest, data?: XHRPostData) {
    // Must run synchronously, before `originalSend`, so a fetch wrapper that
    // called this XHR's owning `fetch()` synchronously sees the flag.
    markActiveFetchCallSentXhr();

    const meta = pendingMeta.get(this);
    if (alive && activeRecorder && meta) {
      setupRequestOverride(overridesRegistry, this, meta.url);

      const handle = activeRecorder.begin({
        url: meta.url,
        method: meta.method,
        headers: meta.headers,
        postData: getRequestBody(data),
        type: 'XHR',
        source: 'builtin',
        initiator: getInitiatorFromStack(),
      });

      requestIdByXhr.set(this, handle.requestId);

      if (this.addEventListener) {
        this.addEventListener('readystatechange', () => {
          if (this.readyState === this.HEADERS_RECEIVED) handle.markHeadersReceived();
        });

        this.addEventListener('progress', (event) => {
          handle.progress(event.loaded, event.total, event.lengthComputable);
        });

        this.addEventListener('load', () => {
          handle.headers({
            url: meta.url,
            status: this.status,
            statusText: this.statusText,
            headers: applyReactNativeResponseHeadersLogic(this.responseHeaders || {}),
            contentType: getContentType(this),
            size: getResponseSize(this),
          });
        });

        this.addEventListener('loadend', () => {
          handle.end({ size: getResponseSize(this), body: () => getResponseBody(this) });
        });

        this.addEventListener('error', () => handle.fail('Failed', false));
        this.addEventListener('abort', () => handle.fail('Aborted', true));
        this.addEventListener('timeout', () => handle.fail('Timeout', false));
      }
    }

    // @ts-expect-error - forwarding the original arguments
    return originalSend.apply(this, arguments);
  };

  installed = {
    previous,
    patched: {
      open: XHRCtor.prototype.open,
      send: XHRCtor.prototype.send,
      setRequestHeader: XHRCtor.prototype.setRequestHeader,
    },
    retire: () => (alive = false),
  };
};

export const disableXhrHook = (): void => {
  if (!installed) return;
  const { previous, patched, retire } = installed;
  retire();
  // Restore only the methods still ours — something else may have patched
  // over us since `enable()`, and clobbering that patch would be worse than
  // leaving it in place.
  if (XHRCtor.prototype.open === patched.open) XHRCtor.prototype.open = previous.open;
  if (XHRCtor.prototype.send === patched.send) XHRCtor.prototype.send = previous.send;
  if (XHRCtor.prototype.setRequestHeader === patched.setRequestHeader) {
    XHRCtor.prototype.setRequestHeader = previous.setRequestHeader;
  }
  installed = null;
  activeRecorder = null;
};
