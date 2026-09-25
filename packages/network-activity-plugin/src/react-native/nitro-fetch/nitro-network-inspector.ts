import { createNanoEvents } from 'nanoevents';
import type { HttpHeaders, HttpMethod, RequestPostData } from '../../shared/client';
import type { WebSocketEventMap } from '../../shared/websocket-events';
import type { Inspector } from '../inspector';
import type { Recorder } from '../http/recorder';
import { appendHeader } from '../http/http-utils';

// nitro was silently truncating bodies and WebSocket messages at its 4 KiB
// default; the DevTools panel already handles payloads of this size from the
// built-in path. It applies to response bodies, request bodies and
// WebSocket messages alike. nitro's entry count is left at its default:
// nitro drops the oldest entry regardless of type, and a WebSocket entry
// dropped that way stops reporting messages.
const NITRO_MAX_BODY_CAPTURE = 1024 * 1024;

type NitroModule = {
  NetworkInspector: {
    enable: (options?: { maxEntries?: number; maxBodyCapture?: number }) => void;
    disable: () => void;
    isEnabled: () => boolean;
    onEntry: (callback: (entry: NitroEntry) => void) => () => void;
    getEntries: () => ReadonlyArray<NitroEntry>;
  };
};

const getNitroModule = (): NitroModule | null => {
  try {
    return require('react-native-nitro-fetch') as NitroModule;
  } catch {
    return null;
  }
};

// Structural copies of nitro's `NetworkEntry`/`WebSocketEntry`, limited to
// the fields read here. `react-native-nitro-fetch` is an optional peer, so
// importing its types would leak into the published declarations.
type NitroHeader = { key: string; value: string };

type NitroHttpEntry = {
  id: string;
  type: 'http';
  url: string;
  method: string;
  requestHeaders: NitroHeader[];
  requestBody?: string;
  status: number;
  statusText: string;
  responseHeaders: NitroHeader[];
  responseBody?: string;
  responseBodySize: number;
  startTime: number;
  endTime: number;
  error?: string;
};

type NitroWebSocketEntry = {
  id: string;
  type: 'websocket';
  url: string;
  protocols: string[];
  startTime: number;
  endTime: number;
  readyState: string;
  messages: Array<{
    direction: 'sent' | 'received';
    data: string;
    isBinary: boolean;
    timestamp: number;
  }>;
  closeCode?: number;
  closeReason?: string;
  error?: string;
};

type NitroEntry = NitroHttpEntry | NitroWebSocketEntry;

type NitroWebSocketEventMap = Pick<
  WebSocketEventMap,
  | 'websocket-connect'
  | 'websocket-open'
  | 'websocket-close'
  | 'websocket-message-sent'
  | 'websocket-message-received'
  | 'websocket-error'
>;

type NanoEventsMap = {
  [K in keyof NitroWebSocketEventMap]: (data: NitroWebSocketEventMap[K]) => void;
};

export type NitroNetworkInspector = Inspector<NitroWebSocketEventMap>;

// HTTP entries are one-shot recorder calls now (see `emitHttpEntry` below); only
// WebSocket events are still delivered through this inspector's own emitter.
export const NITRO_NETWORK_EVENTS: (keyof NitroWebSocketEventMap)[] = [
  'websocket-connect',
  'websocket-open',
  'websocket-close',
  'websocket-message-sent',
  'websocket-message-received',
  'websocket-error',
];

const timestampOrigin =
  typeof performance !== 'undefined' && typeof performance.timeOrigin === 'number'
    ? performance.timeOrigin
    : Date.now() - performance.now();

const toEpochTime = (timestamp: number) => Math.round(timestampOrigin + timestamp);

const toHeaders = (headers: { key: string; value: string }[]): HttpHeaders => {
  const result: HttpHeaders = {};
  headers.forEach(({ key, value }) => appendHeader(result, key, value));
  return result;
};

const toPostData = (body?: string): RequestPostData =>
  body == null ? undefined : { type: 'text', value: body };

const getContentType = (headers: { key: string; value: string }[]) =>
  headers.find((header) => header.key.toLowerCase() === 'content-type')?.value ?? 'text/plain';

/**
 * Translates one nitro HTTP entry into a single recorder call sequence:
 * `begin` then either `fail`, or `headers` and `end`. nitro's
 * `NetworkInspector` notifies HTTP entries exactly once, at the end, so there
 * is no snapshot diffing to do here — unlike WebSocket entries below.
 */
const emitHttpEntry = (recorder: Recorder, entry: NitroHttpEntry): void => {
  const sendTime = toEpochTime(entry.startTime);
  const handle = recorder.begin({
    url: entry.url,
    method: entry.method as HttpMethod,
    headers: toHeaders(entry.requestHeaders),
    postData: toPostData(entry.requestBody),
    type: 'Fetch',
    source: 'nitro',
    initiator: { type: 'other' },
    timestamp: sendTime,
  });

  const responseTimestamp = toEpochTime(entry.endTime || entry.startTime);

  if (entry.error) {
    handle.fail(entry.error, entry.error === 'Request canceled', responseTimestamp);
    return;
  }

  handle.headers({
    url: entry.url,
    status: entry.status,
    statusText: entry.statusText,
    headers: toHeaders(entry.responseHeaders),
    contentType: getContentType(entry.responseHeaders),
    size: entry.responseBodySize,
    timestamp: responseTimestamp,
  });

  handle.end({
    size: entry.responseBodySize,
    body: entry.responseBody ?? null,
    timestamp: responseTimestamp,
  });
};

// Only what WebSocket diffing needs — not a clone of the whole entry (with
// its full message history), which made every notification O(n) to snapshot
// and the run O(n²).
type WebSocketSnapshot = { readyState: string; messageCount: number; error?: string };

const snapshotWebSocket = (entry: NitroWebSocketEntry): WebSocketSnapshot => ({
  readyState: entry.readyState,
  messageCount: entry.messages.length,
  error: entry.error,
});

export const createNitroNetworkInspector = (
  recorder: Recorder,
  getModule: () => NitroModule | null = getNitroModule,
): NitroNetworkInspector => {
  const eventEmitter = createNanoEvents<NanoEventsMap>();
  const previousWebSocketEntries = new Map<string, WebSocketSnapshot>();
  let nitroModule: NitroModule | null = null;
  let unsubscribe: (() => void) | null = null;

  const emitWebSocketEvents = (entry: NitroWebSocketEntry, previous?: WebSocketSnapshot) => {
    const socketId = entry.id;
    const readyState = entry.readyState.toUpperCase();
    const previousReadyState = previous?.readyState.toUpperCase() ?? null;

    if (!previous) {
      eventEmitter.emit('websocket-connect', {
        type: 'websocket-connect',
        url: entry.url,
        socketId,
        timestamp: toEpochTime(entry.startTime),
        protocols: entry.protocols,
        options: [],
        source: 'nitro',
      });
    }

    if (readyState === 'OPEN' && previousReadyState !== 'OPEN') {
      eventEmitter.emit('websocket-open', {
        type: 'websocket-open',
        url: entry.url,
        socketId,
        timestamp: toEpochTime(entry.startTime),
        source: 'nitro',
      });
    }

    const previousMessageCount = previous?.messageCount ?? 0;
    for (const message of entry.messages.slice(previousMessageCount)) {
      const event = {
        url: entry.url,
        socketId,
        timestamp: toEpochTime(message.timestamp),
        data: message.data,
        messageType: message.isBinary ? ('binary' as const) : ('text' as const),
        source: 'nitro' as const,
      };

      if (message.direction === 'sent') {
        eventEmitter.emit('websocket-message-sent', { type: 'websocket-message-sent', ...event });
      } else {
        eventEmitter.emit('websocket-message-received', {
          type: 'websocket-message-received',
          ...event,
        });
      }
    }

    if (entry.error && entry.error !== previous?.error) {
      eventEmitter.emit('websocket-error', {
        type: 'websocket-error',
        url: entry.url,
        socketId,
        timestamp: toEpochTime(entry.endTime || entry.startTime),
        error: entry.error,
        source: 'nitro',
      });
    }

    if (readyState === 'CLOSED' && previousReadyState !== 'CLOSED') {
      eventEmitter.emit('websocket-close', {
        type: 'websocket-close',
        url: entry.url,
        socketId,
        timestamp: toEpochTime(entry.endTime || entry.startTime),
        code: entry.closeCode ?? 0,
        reason: entry.closeReason,
        source: 'nitro',
      });
    }
  };

  const handleEntry = (entry: NitroEntry) => {
    if (entry.type === 'http') {
      emitHttpEntry(recorder, entry);
      return;
    }

    emitWebSocketEvents(entry, previousWebSocketEntries.get(entry.id));
    previousWebSocketEntries.set(entry.id, snapshotWebSocket(entry));
  };

  return {
    enable() {
      if (unsubscribe) return;

      nitroModule = getModule();
      if (!nitroModule) return;

      nitroModule.NetworkInspector.enable({
        maxBodyCapture: NITRO_MAX_BODY_CAPTURE,
      });
      // Seed already-open WebSocket entries so re-enabling doesn't replay
      // their `connect`/`open`. Pre-existing HTTP entries are not replayed:
      // HTTP notifications are one-shot, so there is nothing to diff against.
      for (const entry of nitroModule.NetworkInspector.getEntries()) {
        if (entry.type === 'websocket')
          previousWebSocketEntries.set(entry.id, snapshotWebSocket(entry));
      }
      unsubscribe = nitroModule.NetworkInspector.onEntry(handleEntry);
    },

    disable() {
      unsubscribe?.();
      unsubscribe = null;
      nitroModule?.NetworkInspector.disable();
    },

    isEnabled() {
      return nitroModule?.NetworkInspector.isEnabled() ?? false;
    },

    dispose() {
      unsubscribe?.();
      unsubscribe = null;
      previousWebSocketEntries.clear();
      nitroModule?.NetworkInspector.disable();
      nitroModule = null;
    },

    on<TEventType extends keyof NitroWebSocketEventMap>(
      event: TEventType,
      callback: (data: NitroWebSocketEventMap[TEventType]) => void,
    ) {
      return eventEmitter.on(event, callback as NanoEventsMap[TEventType]);
    },
  };
};
