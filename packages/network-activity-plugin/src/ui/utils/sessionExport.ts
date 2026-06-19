import type {
  HttpNetworkEntry,
  NetworkEntry,
  RequestId,
  SSENetworkEntry,
  WebSocketMessage,
  WebSocketNetworkEntry,
} from '../state/model';

const EXPORT_SCHEMA_VERSION = 1;

type ExportedHttpEntry = {
  id: RequestId;
  type: 'http';
  source?: NetworkEntry['source'];
  timestamp: number;
  duration: number | null;
  status: HttpNetworkEntry['status'];
  error?: string;
  canceled?: boolean;
  request: HttpNetworkEntry['request'];
  response: HttpNetworkEntry['response'] | null;
  size: number | null;
  ttfb: number | null;
  initiator?: HttpNetworkEntry['initiator'];
  resourceType?: HttpNetworkEntry['resourceType'];
  progress?: HttpNetworkEntry['progress'];
};

type ExportedWebSocketEntry = {
  id: RequestId;
  type: 'websocket';
  source?: NetworkEntry['source'];
  timestamp: number;
  duration: number | null;
  status: WebSocketNetworkEntry['status'];
  connection: WebSocketNetworkEntry['connection'];
  error?: string;
  closeCode?: number;
  closeReason?: string;
  messages: WebSocketMessage[];
};

type ExportedSSEEntry = {
  id: RequestId;
  type: 'sse';
  source?: NetworkEntry['source'];
  timestamp: number;
  duration: number | null;
  status: SSENetworkEntry['status'];
  error?: string;
  request: SSENetworkEntry['request'];
  response: SSENetworkEntry['response'] | null;
  initiator?: SSENetworkEntry['initiator'];
  resourceType?: SSENetworkEntry['resourceType'];
  messages: SSENetworkEntry['messages'];
};

export type ExportedNetworkEntry =
  | ExportedHttpEntry
  | ExportedWebSocketEntry
  | ExportedSSEEntry;

export type NetworkActivitySessionExport = {
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  tool: 'rozenite-network-activity';
  exportedAt: string;
  summary: {
    totalEntries: number;
    httpRequests: number;
    webSocketConnections: number;
    sseConnections: number;
    realtimeMessages: number;
  };
  entries: ExportedNetworkEntry[];
};

const getDuration = (duration: number | undefined) => duration ?? null;

const serializeHttpEntry = (entry: HttpNetworkEntry): ExportedHttpEntry => ({
  id: entry.id,
  type: 'http',
  source: entry.source,
  timestamp: entry.timestamp,
  duration: getDuration(entry.duration),
  status: entry.status,
  error: entry.error,
  canceled: entry.canceled,
  request: entry.request,
  response: entry.response ?? null,
  size: entry.size ?? null,
  ttfb: entry.ttfb ?? null,
  initiator: entry.initiator,
  resourceType: entry.resourceType,
  progress: entry.progress,
});

const serializeWebSocketEntry = (
  entry: WebSocketNetworkEntry,
  websocketMessages: Map<RequestId, WebSocketMessage[]>,
): ExportedWebSocketEntry => ({
  id: entry.id,
  type: 'websocket',
  source: entry.source,
  timestamp: entry.timestamp,
  duration: getDuration(entry.duration),
  status: entry.status,
  connection: entry.connection,
  error: entry.error,
  closeCode: entry.closeCode,
  closeReason: entry.closeReason,
  messages: websocketMessages.get(entry.id) ?? [],
});

const serializeSSEEntry = (entry: SSENetworkEntry): ExportedSSEEntry => ({
  id: entry.id,
  type: 'sse',
  source: entry.source,
  timestamp: entry.timestamp,
  duration: getDuration(entry.duration),
  status: entry.status,
  error: entry.error,
  request: entry.request,
  response: entry.response ?? null,
  initiator: entry.initiator,
  resourceType: entry.resourceType,
  messages: entry.messages,
});

const serializeEntry = (
  entry: NetworkEntry,
  websocketMessages: Map<RequestId, WebSocketMessage[]>,
): ExportedNetworkEntry => {
  switch (entry.type) {
    case 'http':
      return serializeHttpEntry(entry);
    case 'websocket':
      return serializeWebSocketEntry(entry, websocketMessages);
    case 'sse':
      return serializeSSEEntry(entry);
  }
};

export const createNetworkActivitySessionExport = (
  networkEntries: Map<RequestId, NetworkEntry>,
  websocketMessages: Map<RequestId, WebSocketMessage[]>,
  exportedAt = new Date(),
): NetworkActivitySessionExport => {
  const entries = Array.from(networkEntries.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((entry) => serializeEntry(entry, websocketMessages));

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    tool: 'rozenite-network-activity',
    exportedAt: exportedAt.toISOString(),
    summary: {
      totalEntries: entries.length,
      httpRequests: entries.filter((entry) => entry.type === 'http').length,
      webSocketConnections: entries.filter(
        (entry) => entry.type === 'websocket',
      ).length,
      sseConnections: entries.filter((entry) => entry.type === 'sse').length,
      realtimeMessages: entries.reduce((count, entry) => {
        if (entry.type === 'websocket' || entry.type === 'sse') {
          return count + entry.messages.length;
        }

        return count;
      }, 0),
    },
    entries,
  };
};

export const getNetworkActivitySessionExportFileName = (
  exportedAt = new Date(),
) => {
  const timestamp = exportedAt
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[:]/g, '-');

  return `rozenite-network-session-${timestamp}.json`;
};
