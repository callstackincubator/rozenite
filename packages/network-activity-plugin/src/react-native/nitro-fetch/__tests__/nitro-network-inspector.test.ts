import { describe, expect, it } from 'vitest';
import { createNitroNetworkInspector } from '../nitro-network-inspector';

describe('nitro network inspector', () => {
  it('translates nitro websocket updates with direct string ids and no duplicate messages', () => {
    const listeners = new Set<(entry: any) => void>();
    const inspector = createNitroNetworkInspector(() => ({
      NetworkInspector: {
        enable() {},
        disable() {},
        isEnabled() {
          return true;
        },
        onEntry(callback) {
          listeners.add(callback);
          return () => listeners.delete(callback);
        },
        getEntries() {
          return [];
        },
      },
    }));

    const events: Array<{ type: string; socketId?: string; data?: string }> =
      [];
    inspector.on('websocket-connect', (event) => {
      events.push({ type: event.type, socketId: event.socketId });
    });
    inspector.on('websocket-open', (event) => {
      events.push({ type: event.type, socketId: event.socketId });
    });
    inspector.on('websocket-message-sent', (event) => {
      events.push({
        type: event.type,
        socketId: event.socketId,
        data: event.data,
      });
    });
    inspector.on('websocket-message-received', (event) => {
      events.push({
        type: event.type,
        socketId: event.socketId,
        data: event.data,
      });
    });
    inspector.on('websocket-close', (event) => {
      events.push({ type: event.type, socketId: event.socketId });
    });

    inspector.enable();

    const emit = (entry: any) => {
      for (const listener of listeners) {
        listener(entry);
      }
    };

    emit({
      id: 'nitro-ws-1',
      type: 'websocket',
      url: 'wss://example.com/socket',
      protocols: ['chat'],
      requestHeaders: [],
      startTime: 10,
      endTime: 0,
      duration: 0,
      readyState: 'OPEN',
      messages: [
        {
          direction: 'sent',
          data: 'ping',
          size: 4,
          isBinary: false,
          timestamp: 11,
        },
      ],
      messagesSent: 1,
      messagesReceived: 0,
      bytesSent: 4,
      bytesReceived: 0,
    });

    emit({
      id: 'nitro-ws-1',
      type: 'websocket',
      url: 'wss://example.com/socket',
      protocols: ['chat'],
      requestHeaders: [],
      startTime: 10,
      endTime: 0,
      duration: 0,
      readyState: 'OPEN',
      messages: [
        {
          direction: 'sent',
          data: 'ping',
          size: 4,
          isBinary: false,
          timestamp: 11,
        },
      ],
      messagesSent: 1,
      messagesReceived: 0,
      bytesSent: 4,
      bytesReceived: 0,
    });

    emit({
      id: 'nitro-ws-1',
      type: 'websocket',
      url: 'wss://example.com/socket',
      protocols: ['chat'],
      requestHeaders: [],
      startTime: 10,
      endTime: 15,
      duration: 5,
      readyState: 'CLOSED',
      messages: [
        {
          direction: 'sent',
          data: 'ping',
          size: 4,
          isBinary: false,
          timestamp: 11,
        },
        {
          direction: 'received',
          data: 'pong',
          size: 4,
          isBinary: false,
          timestamp: 12,
        },
      ],
      messagesSent: 1,
      messagesReceived: 1,
      bytesSent: 4,
      bytesReceived: 4,
      closeCode: 1000,
      closeReason: 'done',
    });

    expect(events).toEqual([
      { type: 'websocket-connect', socketId: 'nitro-ws-1' },
      { type: 'websocket-open', socketId: 'nitro-ws-1' },
      { type: 'websocket-message-sent', socketId: 'nitro-ws-1', data: 'ping' },
      {
        type: 'websocket-message-received',
        socketId: 'nitro-ws-1',
        data: 'pong',
      },
      { type: 'websocket-close', socketId: 'nitro-ws-1' },
    ]);
  });

  it('caches nitro http response bodies for later lookup', () => {
    const listeners = new Set<(entry: any) => void>();
    const inspector = createNitroNetworkInspector(() => ({
      NetworkInspector: {
        enable() {},
        disable() {},
        isEnabled() {
          return true;
        },
        onEntry(callback) {
          listeners.add(callback);
          return () => listeners.delete(callback);
        },
        getEntries() {
          return [];
        },
      },
    }));

    inspector.enable();

    for (const listener of listeners) {
      listener({
        id: 'nitro-http-1',
        type: 'http',
        url: 'https://example.com/api',
        method: 'GET',
        requestHeaders: [],
        requestBody: undefined,
        requestBodySize: 0,
        status: 200,
        statusText: 'OK',
        responseHeaders: [{ key: 'content-type', value: 'application/json' }],
        responseBody: '{"ok":true}',
        responseBodySize: 11,
        startTime: 10,
        endTime: 20,
        duration: 10,
      });
    }

    expect(inspector.getResponseBody('nitro-http-1')).toBe('{"ok":true}');
  });
});
