import { describe, expect, it } from 'vitest';
import type {
  HttpNetworkEntry,
  NetworkEntry,
  RequestId,
  SSENetworkEntry,
  WebSocketMessage,
  WebSocketNetworkEntry,
} from '../../state/model';
import {
  createNetworkActivitySessionExport,
  getNetworkActivitySessionExportFileName,
} from '../sessionExport';

const httpEntry: HttpNetworkEntry = {
  id: 'request-1',
  type: 'http',
  timestamp: 100,
  duration: 50,
  source: 'builtin',
  request: {
    url: 'https://example.com/api',
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
  },
  response: {
    url: 'https://example.com/api',
    status: 200,
    statusText: 'OK',
    headers: {
      'content-type': 'application/json',
    },
    contentType: 'application/json',
    size: 17,
    responseTime: 150,
    body: {
      type: 'application/json',
      data: '{"ok":true}',
    },
  },
  status: 'finished',
  ttfb: 20,
  size: 17,
  resourceType: 'Fetch',
};

const websocketEntry: WebSocketNetworkEntry = {
  id: 'ws-socket-1',
  type: 'websocket',
  timestamp: 200,
  duration: 100,
  source: 'builtin',
  connection: {
    url: 'wss://example.com/socket',
    socketId: 'socket-1',
    protocols: ['chat'],
    options: [],
  },
  status: 'closed',
  closeCode: 1000,
};

const sseEntry: SSENetworkEntry = {
  id: 'request-sse',
  type: 'sse',
  timestamp: 300,
  duration: 200,
  source: 'builtin',
  request: {
    url: 'https://example.com/events',
    method: 'GET',
    headers: {},
  },
  response: {
    url: 'https://example.com/events',
    status: 200,
    statusText: 'OK',
    headers: {
      'content-type': 'text/event-stream',
    },
    contentType: 'text/event-stream',
    size: 0,
    responseTime: 310,
  },
  status: 'closed',
  messages: [
    {
      id: 'sse-message-1',
      type: 'message',
      data: 'hello',
      timestamp: 320,
    },
  ],
};

const websocketMessages: WebSocketMessage[] = [
  {
    id: 'websocket-message-1',
    direction: 'sent',
    data: 'ping',
    messageType: 'text',
    timestamp: 210,
  },
  {
    id: 'websocket-message-2',
    direction: 'received',
    data: 'pong',
    messageType: 'text',
    timestamp: 220,
  },
];

describe('sessionExport', () => {
  it('exports captured HTTP and realtime session entries', () => {
    const networkEntries = new Map<RequestId, NetworkEntry>([
      [sseEntry.id, sseEntry],
      [httpEntry.id, httpEntry],
      [websocketEntry.id, websocketEntry],
    ]);
    const exportData = createNetworkActivitySessionExport(
      networkEntries,
      new Map([[websocketEntry.id, websocketMessages]]),
      new Date('2026-05-14T10:00:00.000Z'),
    );

    expect(exportData).toMatchObject({
      schemaVersion: 1,
      tool: 'rozenite-network-activity',
      exportedAt: '2026-05-14T10:00:00.000Z',
      summary: {
        totalEntries: 3,
        httpRequests: 1,
        webSocketConnections: 1,
        sseConnections: 1,
        realtimeMessages: 3,
      },
    });
    expect(exportData.entries.map((entry) => entry.id)).toEqual([
      httpEntry.id,
      websocketEntry.id,
      sseEntry.id,
    ]);
    expect(exportData.entries[0]).toMatchObject({
      type: 'http',
      request: {
        url: 'https://example.com/api',
      },
      response: {
        status: 200,
        body: {
          data: '{"ok":true}',
        },
      },
    });
    expect(exportData.entries[1]).toMatchObject({
      type: 'websocket',
      messages: websocketMessages,
    });
    expect(exportData.entries[2]).toMatchObject({
      type: 'sse',
      messages: sseEntry.messages,
    });
  });

  it('creates filesystem-friendly export filenames', () => {
    expect(
      getNetworkActivitySessionExportFileName(
        new Date('2026-05-14T10:00:00.123Z'),
      ),
    ).toBe('rozenite-network-session-2026-05-14T10-00-00Z.json');
  });
});
