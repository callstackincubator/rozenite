/* eslint-disable prefer-rest-params */
import type { HttpMethod, HttpHeaders, XHRPostData } from '../../shared/client';
import type { Recorder } from './recorder';
import {
  getInitiatorFromStack,
  getRequestBody,
  getResponseBody,
  getResponseSize,
  setupRequestOverride,
} from './http-utils';
import { applyReactNativeResponseHeadersLogic } from '../../utils/applyReactNativeResponseHeadersLogic';
import { getContentType } from '../utils';
import { getOverridesRegistry } from './overrides-registry';
import { markActiveFetchCallSentXhr } from './fetch-dedupe';

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
const originalOpen = XHRCtor.prototype.open;
const originalSend = XHRCtor.prototype.send;
const originalSetRequestHeader = XHRCtor.prototype.setRequestHeader;

const READY_STATE_HEADERS_RECEIVED = 2;

type PendingXhrMeta = {
  method: HttpMethod;
  url: string;
  headers: HttpHeaders;
};

const pendingMeta = new WeakMap<XMLHttpRequest, PendingXhrMeta>();
const requestIdByXhr = new WeakMap<XMLHttpRequest, string>();

/** Used by the SSE inspector instead of a private field written onto the XHR. */
export const getRequestIdForXhr = (xhr: XMLHttpRequest): string | null =>
  requestIdByXhr.get(xhr) ?? null;

const overridesRegistry = getOverridesRegistry();

let enabled = false;
let activeRecorder: Recorder | null = null;

export const isXhrHookEnabled = (): boolean => enabled;

export const enableXhrHook = (recorder: Recorder): void => {
  if (enabled) {
    return;
  }
  activeRecorder = recorder;

  XHRCtor.prototype.open = function (this: XMLHttpRequest, method: string, url: string) {
    pendingMeta.set(this, {
      method: method.toUpperCase() as HttpMethod,
      url,
      headers: {},
    });
    // @ts-expect-error - forwarding the original arguments
    return originalOpen.apply(this, arguments);
  };

  XHRCtor.prototype.setRequestHeader = function (
    this: XMLHttpRequest,
    header: string,
    value: string,
  ) {
    const meta = pendingMeta.get(this);
    if (meta) {
      // RN's own `setRequestHeader` lowercases the header name before storing
      // it (see `XMLHttpRequest.js`); match that so captured request headers
      // keep the same casing they always have on the wire format.
      const key = header.toLowerCase();
      const existing = meta.headers[key];
      meta.headers[key] =
        existing === undefined
          ? value
          : Array.isArray(existing)
            ? [...existing, value]
            : [existing, value];
    }
    // @ts-expect-error - forwarding the original arguments
    return originalSetRequestHeader.apply(this, arguments);
  };

  XHRCtor.prototype.send = function (this: XMLHttpRequest, data?: XHRPostData) {
    // Must run synchronously, before `originalSend`, so a fetch wrapper that
    // called this XHR's owning `fetch()` synchronously sees the flag.
    markActiveFetchCallSentXhr();

    const meta = pendingMeta.get(this);
    if (activeRecorder && meta) {
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
      handle.setBodyThunk(() => getResponseBody(this));

      if (this.addEventListener) {
        this.addEventListener('readystatechange', () => {
          if (this.readyState === READY_STATE_HEADERS_RECEIVED) {
            handle.markHeadersReceived();
          }
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
          handle.end({ size: getResponseSize(this) });
        });

        this.addEventListener('error', () => {
          handle.fail('Failed', false);
        });

        this.addEventListener('abort', () => {
          handle.fail('Aborted', true);
        });

        this.addEventListener('timeout', () => {
          handle.fail('Timeout', false);
        });
      }
    }

    // @ts-expect-error - forwarding the original arguments
    return originalSend.apply(this, arguments);
  };

  enabled = true;
};

export const disableXhrHook = (): void => {
  if (!enabled) {
    return;
  }
  enabled = false;
  XHRCtor.prototype.open = originalOpen;
  XHRCtor.prototype.send = originalSend;
  XHRCtor.prototype.setRequestHeader = originalSetRequestHeader;
  activeRecorder = null;
};
