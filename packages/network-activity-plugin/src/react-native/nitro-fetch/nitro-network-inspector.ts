import { createNanoEvents } from 'nanoevents';
import type { HttpHeaders, HttpMethod, RequestPostData } from '../../shared/client';
import type { WebSocketEventMap } from '../../shared/websocket-events';
import type { Inspector } from '../inspector';
import type { Recorder } from '../http/recorder';
import { getNitroModule as loadNitroModule } from './get-nitro-module';

type NitroHttpHeader = {
  key: string;
  value: string;
};

type NitroHttpEntry = {
  id: string;
  type: 'http';
  url: string;
  method: string;
  requestHeaders: NitroHttpHeader[];
  requestBody?: string;
  requestBodySize: number;
  status: number;
  statusText: string;
  responseHeaders: NitroHttpHeader[];
  responseBody?: string;
  responseBodySize: number;
  startTime: number;
  endTime: number;
  duration: number;
  error?: string;
};

type NitroWebSocketMessage = {
  direction: 'sent' | 'received';
  data: string;
  size: number;
  isBinary: boolean;
  timestamp: number;
};

type NitroWebSocketEntry = {
  id: string;
  type: 'websocket';
  url: string;
  protocols: string[];
  requestHeaders: NitroHttpHeader[];
  startTime: number;
  endTime: number;
  duration: number;
  readyState: string;
  messages: NitroWebSocketMessage[];
  messagesSent: number;
  messagesReceived: number;
  bytesSent: number;
  bytesReceived: number;
  closeCode?: number;
  closeReason?: string;
  error?: string;
};

type NitroInspectorEntry = NitroHttpEntry | NitroWebSocketEntry;

export type NitroModule = {
  NetworkInspector: {
    enable: (options?: { maxBodyCapture?: number }) => void;
    disable: () => void;
    isEnabled: () => boolean;
    onEntry: (callback: (entry: NitroInspectorEntry) => void) => () => void;
    getEntries: () => ReadonlyArray<NitroInspectorEntry>;
  };
};

// nitro bodies were silently truncated at nitro's 4 KiB default; the DevTools
// panel already handles bodies of this size from the built-in path.
const NITRO_MAX_BODY_CAPTURE = 1024 * 1024;

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

const toHeaders = (headers: NitroHttpHeader[]): HttpHeaders => {
  return headers.reduce<HttpHeaders>((acc, { key, value }) => {
    const existing = acc[key];
    if (existing === undefined) {
      acc[key] = value;
      return acc;
    }

    acc[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    return acc;
  }, {});
};

const toPostData = (body?: string): RequestPostData => {
  if (body == null) {
    return undefined;
  }

  return {
    type: 'text',
    value: body,
  };
};

const cloneEntry = <TEntry extends NitroInspectorEntry>(entry: TEntry): TEntry => {
  return JSON.parse(JSON.stringify(entry)) as TEntry;
};

const getContentType = (headers: NitroHttpHeader[]) => {
  return (
    headers.find((header) => header.key.toLowerCase() === 'content-type')?.value ?? 'text/plain'
  );
};

const normalizeReadyState = (readyState: string) => readyState.toUpperCase();

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

export const createNitroNetworkInspector = (
  recorder: Recorder,
  getNitroModule: () => NitroModule | null = loadNitroModule,
): NitroNetworkInspector => {
  const eventEmitter = createNanoEvents<NanoEventsMap>();
  const previousWebSocketEntries = new Map<string, NitroWebSocketEntry>();
  let nitroModule: NitroModule | null = null;
  let unsubscribe: (() => void) | null = null;

  const emitWebSocketEvents = (entry: NitroWebSocketEntry, previous?: NitroWebSocketEntry) => {
    const socketId = entry.id;
    const readyState = normalizeReadyState(entry.readyState);
    const previousReadyState = previous ? normalizeReadyState(previous.readyState) : null;

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

    const previousMessageCount = previous?.messages.length ?? 0;
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
        eventEmitter.emit('websocket-message-sent', {
          type: 'websocket-message-sent',
          ...event,
        });
      } else {
        eventEmitter.emit('websocket-message-received', {
          type: 'websocket-message-received',
          ...event,
        });
      }
    }

    if (entry.error && (!previous || previous.error !== entry.error)) {
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

  const handleEntry = (entry: NitroInspectorEntry) => {
    if (entry.type === 'http') {
      emitHttpEntry(recorder, entry);
      return;
    }

    const previous = previousWebSocketEntries.get(entry.id);
    emitWebSocketEvents(entry, previous);
    previousWebSocketEntries.set(entry.id, cloneEntry(entry));
  };

  return {
    enable() {
      if (unsubscribe) {
        return;
      }

      nitroModule = getNitroModule();
      if (!nitroModule) {
        return;
      }

      nitroModule.NetworkInspector.enable({ maxBodyCapture: NITRO_MAX_BODY_CAPTURE });
      // Seed already-open WebSocket entries so re-enabling doesn't replay
      // their `connect`/`open`. Pre-existing HTTP entries are not replayed:
      // HTTP notifications are one-shot, so there is nothing to diff against.
      for (const entry of nitroModule.NetworkInspector.getEntries()) {
        if (entry.type === 'websocket') {
          previousWebSocketEntries.set(entry.id, cloneEntry(entry));
        }
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

export const getNitroNetworkInspector = ((): ((recorder: Recorder) => NitroNetworkInspector) => {
  let instance: NitroNetworkInspector | null = null;

  return (recorder: Recorder): NitroNetworkInspector => {
    if (!instance) {
      instance = createNitroNetworkInspector(recorder);
    }

    return instance;
  };
})();
