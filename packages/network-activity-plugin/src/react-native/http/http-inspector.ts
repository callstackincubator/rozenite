import { getRecorder } from './recorder';
import { enableXhrHook, disableXhrHook, isXhrHookEnabled } from './xhr-hook';
import { enableFetchHook, disableFetchHook, isFetchHookEnabled } from './fetch-hook';
import type { HttpEventMap } from '../../shared/http-events';
import type { ResponseBody } from '../../shared/client';
import type { Inspector } from '../inspector';

// HTTP-specific event map for the inspector
export type { HttpEventMap };

export const HTTP_EVENTS: (keyof HttpEventMap)[] = [
  'request-sent',
  'response-received',
  'request-completed',
  'request-failed',
  'request-progress',
];

export const isHttpEvent = (type: string): type is keyof HttpEventMap => {
  return (HTTP_EVENTS as readonly string[]).includes(type);
};

export type HTTPInspector = Inspector<HttpEventMap> & {
  getResponseBody: (requestId: string) => Promise<ResponseBody>;
  clearResponseBodies: () => void;
};

/**
 * Thin glue over the recorder and its two adapters. The XHR hook is the
 * primary capture path for the built-in stack; the fetch hook covers every
 * fetch implementation that doesn't send an XHR (see `fetch-dedupe.ts`).
 * nitro traffic is wired up separately, in `network-inspector.ts`, straight
 * into the same recorder.
 */
export const getHTTPInspector = (): HTTPInspector => {
  const recorder = getRecorder();

  return {
    enable: () => {
      if (!isXhrHookEnabled()) {
        enableXhrHook(recorder);
      }
      if (!isFetchHookEnabled()) {
        enableFetchHook(recorder);
      }
    },

    disable: () => {
      disableXhrHook();
      disableFetchHook();
    },

    isEnabled: () => {
      return isXhrHookEnabled() || isFetchHookEnabled();
    },

    dispose: () => {
      disableXhrHook();
      disableFetchHook();
      recorder.clear();
    },

    getResponseBody: (requestId: string) => recorder.getResponseBody(requestId),

    clearResponseBodies: () => recorder.clear(),

    on: (event, callback) => recorder.on(event, callback),
  };
};
