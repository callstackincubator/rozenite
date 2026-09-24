import { describe, expect, it, vi } from 'vitest';
import { createNitroNetworkInspector } from '../nitro-network-inspector';
import type { Recorder } from '../../http/recorder';

const createFakeRecorder = () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];

  const recorder: Recorder = {
    begin: (meta) => {
      calls.push({ method: 'begin', args: [meta] });
      return {
        requestId: 'fake-request-id',
        setBodyThunk: vi.fn(),
        markHeadersReceived: vi.fn(),
        headers: (headersMeta) => calls.push({ method: 'headers', args: [headersMeta] }),
        progress: (...args) => calls.push({ method: 'progress', args }),
        end: (endMeta) => calls.push({ method: 'end', args: [endMeta] }),
        fail: (...args) => calls.push({ method: 'fail', args }),
      };
    },
    getResponseBody: vi.fn(async () => null),
    on: vi.fn(() => () => undefined),
    clear: vi.fn(),
  };

  return { recorder, calls };
};

describe('nitro network inspector', () => {
  it('translates nitro websocket updates with direct string ids and no duplicate messages', () => {
    const listeners = new Set<(entry: any) => void>();
    const { recorder } = createFakeRecorder();
    const inspector = createNitroNetworkInspector(recorder, () => ({
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

    const events: Array<{ type: string; socketId?: string; data?: string }> = [];
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

  it('translates a completed nitro HTTP entry into one begin/headers/end recorder call, with no diffing', () => {
    const listeners = new Set<(entry: any) => void>();
    const { recorder, calls } = createFakeRecorder();
    const inspector = createNitroNetworkInspector(recorder, () => ({
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

    const entry = {
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
    };

    for (const listener of listeners) {
      listener(entry);
      // nitro notifies HTTP entries exactly once; a second, identical
      // notification must still translate to a second full call sequence —
      // there is no previous-entry diffing left to suppress it.
      listener(entry);
    }

    expect(calls.map((call) => call.method)).toEqual([
      'begin',
      'headers',
      'end',
      'begin',
      'headers',
      'end',
    ]);
    expect(calls[0]?.args[0]).toMatchObject({
      url: 'https://example.com/api',
      method: 'GET',
      type: 'Fetch',
      source: 'nitro',
    });
    expect(calls[2]?.args[0]).toMatchObject({
      size: 11,
      body: '{"ok":true}',
    });
  });

  it('translates a failed nitro HTTP entry into begin/fail with no headers or end', () => {
    const listeners = new Set<(entry: any) => void>();
    const { recorder, calls } = createFakeRecorder();
    const inspector = createNitroNetworkInspector(recorder, () => ({
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
        id: 'nitro-http-2',
        type: 'http',
        url: 'https://example.com/fail',
        method: 'GET',
        requestHeaders: [],
        requestBodySize: 0,
        status: 0,
        statusText: '',
        responseHeaders: [],
        responseBodySize: 0,
        startTime: 10,
        endTime: 12,
        duration: 2,
        error: 'Request canceled',
      });
    }

    expect(calls.map((call) => call.method)).toEqual(['begin', 'fail']);
    expect(calls[1]?.args).toEqual(['Request canceled', true, expect.any(Number)]);
  });
});
