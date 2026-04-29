import { createNanoEvents } from 'nanoevents';
import type {
  HttpEventMap,
  HttpHeaders,
  HttpMethod,
  RequestPostData,
} from '../../shared/client';
import type { WebSocketEventMap } from '../../shared/websocket-events';
import type { Inspector } from '../inspector';

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

type NitroModule = {
  NetworkInspector: {
    enable: () => void;
    disable: () => void;
    isEnabled: () => boolean;
    onEntry: (callback: (entry: NitroInspectorEntry) => void) => () => void;
    getEntries: () => ReadonlyArray<NitroInspectorEntry>;
  };
};

type NitroNetworkEventMap = Pick<
  HttpEventMap & WebSocketEventMap,
  | 'request-sent'
  | 'response-received'
  | 'request-completed'
  | 'request-failed'
  | 'websocket-connect'
  | 'websocket-open'
  | 'websocket-close'
  | 'websocket-message-sent'
  | 'websocket-message-received'
  | 'websocket-error'
>;

type NanoEventsMap = {
  [K in keyof NitroNetworkEventMap]: (data: NitroNetworkEventMap[K]) => void;
};

export type NitroNetworkInspector = Inspector<NitroNetworkEventMap> & {
  getResponseBody: (requestId: string) => string | null;
};

export const NITRO_NETWORK_EVENTS: (keyof NitroNetworkEventMap)[] = [
  'request-sent',
  'response-received',
  'request-completed',
  'request-failed',
  'websocket-connect',
  'websocket-open',
  'websocket-close',
  'websocket-message-sent',
  'websocket-message-received',
  'websocket-error',
];

const loadNitroModule = (): NitroModule | null => {
  try {
    return require('react-native-nitro-fetch') as NitroModule;
  } catch {
    return null;
  }
};

const timestampOrigin =
  typeof performance !== 'undefined' &&
  typeof performance.timeOrigin === 'number'
    ? performance.timeOrigin
    : Date.now() - performance.now();

const toEpochTime = (timestamp: number) =>
  Math.round(timestampOrigin + timestamp);

const toHeaders = (headers: NitroHttpHeader[]): HttpHeaders => {
  return headers.reduce<HttpHeaders>((acc, { key, value }) => {
    const existing = acc[key];
    if (existing === undefined) {
      acc[key] = value;
      return acc;
    }

    acc[key] = Array.isArray(existing)
      ? [...existing, value]
      : [existing, value];
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

const cloneEntry = <TEntry extends NitroInspectorEntry>(
  entry: TEntry,
): TEntry => {
  return JSON.parse(JSON.stringify(entry)) as TEntry;
};

const getContentType = (headers: NitroHttpHeader[]) => {
  return (
    headers.find((header) => header.key.toLowerCase() === 'content-type')
      ?.value ?? 'text/plain'
  );
};

const normalizeReadyState = (readyState: string) => readyState.toUpperCase();

export const createNitroNetworkInspector = (
  getNitroModule: () => NitroModule | null = loadNitroModule,
): NitroNetworkInspector => {
  const eventEmitter = createNanoEvents<NanoEventsMap>();
  const previousEntries = new Map<string, NitroInspectorEntry>();
  const responseBodies = new Map<string, string | null>();
  let nitroModule: NitroModule | null = null;
  let unsubscribe: (() => void) | null = null;

  const emitHttpEvents = (entry: NitroHttpEntry, previous?: NitroHttpEntry) => {
    if (!previous) {
      eventEmitter.emit('request-sent', {
        requestId: entry.id,
        timestamp: toEpochTime(entry.startTime),
        request: {
          url: entry.url,
          method: entry.method as HttpMethod,
          headers: toHeaders(entry.requestHeaders),
          postData: toPostData(entry.requestBody),
        },
        initiator: { type: 'other' },
        type: 'Fetch',
        source: 'nitro',
      });
    }

    if (entry.error) {
      if (!previous || previous.error !== entry.error) {
        eventEmitter.emit('request-failed', {
          requestId: entry.id,
          timestamp: toEpochTime(entry.endTime || entry.startTime),
          type: 'Fetch',
          error: entry.error,
          canceled: entry.error === 'Request canceled',
          source: 'nitro',
        });
      }
      return;
    }

    const didResponseChange =
      !previous ||
      previous.status !== entry.status ||
      previous.statusText !== entry.statusText ||
      previous.responseBodySize !== entry.responseBodySize ||
      previous.endTime !== entry.endTime;

    if (!didResponseChange) {
      return;
    }

    const responseTimestamp = toEpochTime(entry.endTime || entry.startTime);

    eventEmitter.emit('response-received', {
      requestId: entry.id,
      timestamp: responseTimestamp,
      type: 'Fetch',
      response: {
        url: entry.url,
        status: entry.status,
        statusText: entry.statusText,
        headers: toHeaders(entry.responseHeaders),
        contentType: getContentType(entry.responseHeaders),
        size: entry.responseBodySize,
        responseTime: responseTimestamp,
      },
      source: 'nitro',
    });

    eventEmitter.emit('request-completed', {
      requestId: entry.id,
      timestamp: responseTimestamp,
      duration: entry.duration,
      size: entry.responseBodySize,
      ttfb: entry.duration,
      source: 'nitro',
    });
  };

  const emitWebSocketEvents = (
    entry: NitroWebSocketEntry,
    previous?: NitroWebSocketEntry,
  ) => {
    const socketId = entry.id;
    const readyState = normalizeReadyState(entry.readyState);
    const previousReadyState = previous
      ? normalizeReadyState(previous.readyState)
      : null;

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
    const previous = previousEntries.get(entry.id);

    if (entry.type === 'http') {
      responseBodies.set(entry.id, entry.responseBody ?? null);
      emitHttpEvents(entry, previous as NitroHttpEntry | undefined);
    } else {
      emitWebSocketEvents(entry, previous as NitroWebSocketEntry | undefined);
    }

    previousEntries.set(entry.id, cloneEntry(entry));
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

      nitroModule.NetworkInspector.enable();
      for (const entry of nitroModule.NetworkInspector.getEntries()) {
        previousEntries.set(entry.id, cloneEntry(entry));
        if (entry.type === 'http') {
          responseBodies.set(entry.id, entry.responseBody ?? null);
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
      previousEntries.clear();
      responseBodies.clear();
      nitroModule?.NetworkInspector.disable();
      nitroModule = null;
    },

    getResponseBody(requestId: string) {
      return responseBodies.get(requestId) ?? null;
    },

    on<TEventType extends keyof NitroNetworkEventMap>(
      event: TEventType,
      callback: (data: NitroNetworkEventMap[TEventType]) => void,
    ) {
      return eventEmitter.on(event, callback as NanoEventsMap[TEventType]);
    },
  };
};

export const getNitroNetworkInspector = (() => {
  let instance: NitroNetworkInspector | null = null;

  return (): NitroNetworkInspector => {
    if (!instance) {
      instance = createNitroNetworkInspector();
    }

    return instance;
  };
})();
