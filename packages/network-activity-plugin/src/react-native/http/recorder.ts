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
 * Owns the HTTP wire format: request ids, timing, every `HttpEventMap`
 * payload, and the response body registry (one lazily-resolved thunk per
 * request id, evicted five minutes after registration). Adapters (XHR,
 * fetch, nitro) call `begin()` then `headers()`/`progress()`/`end()`/`fail()`
 * on the handle — they never build an event payload themselves.
 */

type NanoEventsMap = { [K in keyof HttpEventMap]: (data: HttpEventMap[K]) => void };

const RESPONSE_BODY_TTL = 5 * 60 * 1000;

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
  /** Marks when headers became available, for time-to-first-byte. The XHR
   * adapter calls it at `readyState === HEADERS_RECEIVED`, ahead of
   * `headers()`/`end()` which fire later; `headers()` marks it too, for
   * adapters whose headers and body arrive together. */
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
      if (now - entry.sentAt >= RESPONSE_BODY_TTL) bodies.delete(id);
    }
  };

  return {
    begin(meta) {
      const requestId = createRequestId();
      const sendTime = meta.timestamp ?? Date.now();
      let headersAt: number | null = null;

      eventEmitter.emit('request-sent', {
        requestId,
        timestamp: sendTime,
        request: {
          url: meta.url,
          method: meta.method,
          headers: meta.headers,
          postData: meta.postData,
        },
        initiator: meta.initiator,
        type: meta.type,
        source: meta.source,
      });

      return {
        requestId,

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
            // Real wall-clock time, deliberately independent of `sendTime`:
            // nitro synthesizes its timestamps from `performance.timeOrigin`,
            // which isn't guaranteed to line up with `Date.now()`.
            trimBodies();
            const body = endMeta.body;
            bodies.set(requestId, {
              sentAt: Date.now(),
              thunk: typeof body === 'function' ? body : () => body,
            });
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
      return (await bodies.get(requestId)?.thunk()) ?? null;
    },

    on: (event, callback) => eventEmitter.on(event, callback as NanoEventsMap[typeof event]),

    clear: () => bodies.clear(),
  };
};

/** Shared by every HTTP capture adapter, so one event stream and one body
 * registry back the whole HTTP surface regardless of which adapter captured
 * a given request. */
export const recorder = createRecorder();
