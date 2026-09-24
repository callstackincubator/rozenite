import { createNanoEvents } from 'nanoevents';
import type {
  HttpEventMap,
  HttpHeaders,
  HttpMethod,
  Initiator,
  NetworkEventSource,
  RequestPostData,
  ResourceType,
  ResponseBody,
} from '../../shared/client';

/**
 * The single owner of the HTTP wire format: request ids, timing (send time,
 * duration, time to first byte) and every `HttpEventMap` payload. The three
 * capture adapters (XHR, fetch, nitro) call `begin()` and then `headers()`,
 * `progress()`, `end()` or `fail()` on the returned handle — they never
 * construct an event payload themselves.
 *
 * It also owns the response body registry: one lazily-resolved thunk per
 * request id, evicted five minutes after the request was sent. The XHR
 * adapter registers a lazy read of the live `XMLHttpRequest`; the fetch and
 * nitro adapters register the body they already captured.
 */

type NanoEventsMap = {
  [K in keyof HttpEventMap]: (data: HttpEventMap[K]) => void;
};

const RESPONSE_BODY_TTL = 1000 * 60 * 5; // 5 minutes

export type BodyThunk = () => Promise<ResponseBody> | ResponseBody;

export type BeginMeta = {
  url: string;
  method: HttpMethod;
  headers: HttpHeaders;
  postData?: RequestPostData;
  type: ResourceType;
  source: NetworkEventSource;
  initiator: Initiator;
  /** Defaults to `Date.now()`. Adapters with their own clock (nitro) pass it explicitly. */
  timestamp?: number;
  /**
   * Fetch-only, and not part of the `Request` wire type: the pre-rewrite
   * fetch capture path shipped the request's `AbortSignal` on the wire as an
   * incidental side effect of forwarding its whole normalized request
   * object. It carries no information once serialized (an `AbortSignal` has
   * no enumerable own properties, so it always serializes to `{}`), but the
   * wire format is frozen, so the fetch hook still passes it through here.
   */
  requestSignal?: AbortSignal;
};

export type HeadersMeta = {
  /** Defaults to the request URL from `begin()`. */
  url?: string;
  status: number;
  statusText: string;
  headers: HttpHeaders;
  contentType: string;
  size: number | null;
  timestamp?: number;
};

export type EndMeta = {
  size: number | null;
  body?: ResponseBody | BodyThunk;
  timestamp?: number;
};

export type RecorderHandle = {
  readonly requestId: string;
  /** Registers the response body thunk without waiting for completion (used by the XHR adapter). */
  setBodyThunk: (thunk: BodyThunk) => void;
  /**
   * Marks the moment headers became available, for time-to-first-byte.
   * The XHR adapter calls this at `readyState === HEADERS_RECEIVED`, ahead of
   * `headers()`/`end()` which fire later, at `load`/`loadend`. Adapters whose
   * headers and body arrive together (fetch, nitro) don't need it — `headers()`
   * marks it for them.
   */
  markHeadersReceived: (timestamp?: number) => void;
  headers: (meta: HeadersMeta) => void;
  progress: (loaded: number, total: number, lengthComputable: boolean, timestamp?: number) => void;
  end: (meta: EndMeta) => void;
  fail: (error: string, canceled: boolean, timestamp?: number) => void;
};

export type Recorder = {
  begin: (meta: BeginMeta) => RecorderHandle;
  getResponseBody: (requestId: string) => Promise<ResponseBody>;
  on: <TEventType extends keyof HttpEventMap>(
    event: TEventType,
    callback: (data: HttpEventMap[TEventType]) => void,
  ) => () => void;
  clear: () => void;
};

const createRequestId = () => `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

export const createRecorder = (): Recorder => {
  const eventEmitter = createNanoEvents<NanoEventsMap>();
  const bodies = new Map<string, { sentAt: number; thunk: BodyThunk }>();

  const trimBodies = () => {
    const now = Date.now();
    for (const [id, entry] of bodies) {
      if (now - entry.sentAt >= RESPONSE_BODY_TTL) {
        bodies.delete(id);
      }
    }
  };

  // The TTL clock for the body registry is real wall-clock time, taken at
  // registration, deliberately independent of the event's own `timestamp`
  // (adapters like nitro synthesize theirs from `performance.timeOrigin`,
  // which is not guaranteed to line up with `Date.now()`).
  const registerBody = (requestId: string, thunk: BodyThunk) => {
    trimBodies();
    bodies.set(requestId, { sentAt: Date.now(), thunk });
  };

  return {
    begin(meta) {
      const requestId = createRequestId();
      const sendTime = meta.timestamp ?? Date.now();

      const requestPayload = {
        url: meta.url,
        method: meta.method,
        headers: meta.headers,
        postData: meta.postData,
        ...(meta.requestSignal !== undefined ? { signal: meta.requestSignal } : {}),
      } as HttpEventMap['request-sent']['request'];

      eventEmitter.emit('request-sent', {
        requestId,
        timestamp: sendTime,
        request: requestPayload,
        initiator: meta.initiator,
        type: meta.type,
        source: meta.source,
      });

      let headersAt: number | null = null;

      return {
        requestId,

        setBodyThunk: (thunk) => {
          registerBody(requestId, thunk);
        },

        markHeadersReceived: (timestamp) => {
          headersAt ??= timestamp ?? Date.now();
        },

        headers: (headersMeta) => {
          const timestamp = headersMeta.timestamp ?? Date.now();
          headersAt ??= timestamp;
          eventEmitter.emit('response-received', {
            requestId,
            timestamp,
            type: meta.type,
            response: {
              url: headersMeta.url ?? meta.url,
              status: headersMeta.status,
              statusText: headersMeta.statusText,
              headers: headersMeta.headers,
              contentType: headersMeta.contentType,
              size: headersMeta.size,
              responseTime: timestamp,
            },
            source: meta.source,
          });
        },

        progress: (loaded, total, lengthComputable, timestamp) => {
          eventEmitter.emit('request-progress', {
            requestId,
            timestamp: timestamp ?? Date.now(),
            loaded,
            total,
            lengthComputable,
            source: meta.source,
          });
        },

        end: (endMeta) => {
          const timestamp = endMeta.timestamp ?? Date.now();
          if (endMeta.body !== undefined) {
            const thunk =
              typeof endMeta.body === 'function'
                ? endMeta.body
                : () => endMeta.body as ResponseBody;
            registerBody(requestId, thunk);
          }
          eventEmitter.emit('request-completed', {
            requestId,
            timestamp,
            duration: timestamp - sendTime,
            size: endMeta.size,
            ttfb: headersAt !== null ? headersAt - sendTime : 0,
            source: meta.source,
          });
        },

        fail: (error, canceled, timestamp) => {
          eventEmitter.emit('request-failed', {
            requestId,
            timestamp: timestamp ?? Date.now(),
            type: meta.type,
            error,
            canceled,
            source: meta.source,
          });
        },
      };
    },

    async getResponseBody(requestId) {
      trimBodies();
      const entry = bodies.get(requestId);
      if (!entry) {
        return null;
      }
      return entry.thunk();
    },

    on: (event, callback) => eventEmitter.on(event, callback as NanoEventsMap[typeof event]),

    clear: () => {
      bodies.clear();
    },
  };
};

/**
 * The recorder is a singleton shared by every HTTP capture adapter (XHR,
 * fetch, nitro) so a single event stream and a single body registry back the
 * whole HTTP surface, regardless of which adapter captured a given request.
 */
export const getRecorder = ((): (() => Recorder) => {
  let instance: Recorder | null = null;

  return (): Recorder => {
    if (!instance) {
      instance = createRecorder();
    }
    return instance;
  };
})();
