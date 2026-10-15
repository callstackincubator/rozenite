import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it("enables nitro with a 1 MiB body cap and nitro's default entry count", () => {
    const { recorder } = createFakeRecorder();
    const enable = vi.fn();
    const inspector = createNitroNetworkInspector(recorder, () => ({
      NetworkInspector: {
        enable,
        disable() {},
        isEnabled() {
          return true;
        },
        onEntry() {
          return () => undefined;
        },
        getEntries() {
          return [];
        },
      },
    }));

    inspector.enable();

    // nitro drops its oldest entry regardless of type, and a dropped
    // WebSocket entry stops reporting messages, so the count stays default.
    expect(enable).toHaveBeenCalledWith({ maxBodyCapture: 1024 * 1024 });
  });
});

describe('nitro timestamps', () => {
  const wallTime = Date.parse('2026-10-15T09:58:00.042Z');
  const monotonicTime = 10_000.25;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it.each([
    { name: 'ahead', offset: 400_000_000 },
    { name: 'behind', offset: -400_000_000 },
    { name: 'aligned', offset: 0 },
    { name: 'missing', offset: undefined },
  ])(
    'aligns HTTP and WebSocket events with wall time when timeOrigin is $name',
    async ({ offset }) => {
      vi.spyOn(Date, 'now').mockReturnValue(wallTime);
      vi.stubGlobal('performance', {
        now: () => monotonicTime,
        timeOrigin: offset === undefined ? undefined : wallTime - monotonicTime + offset,
      });
      vi.resetModules();
      const { createNitroNetworkInspector } = await import('../nitro-network-inspector');
      const { recorder, calls } = createFakeRecorder();
      let emit: (entry: any) => void = () => undefined;
      const inspector = createNitroNetworkInspector(recorder, () => ({
        NetworkInspector: {
          enable() {},
          disable() {},
          isEnabled: () => true,
          onEntry(callback) {
            emit = callback;
            return () => undefined;
          },
          getEntries: () => [],
        },
      }));
      inspector.enable();

      const httpEntry = {
        id: 'nitro-http-clock',
        type: 'http',
        url: 'https://example.com/api',
        method: 'GET',
        requestHeaders: [],
        status: 200,
        statusText: 'OK',
        responseHeaders: [],
        responseBodySize: 0,
        startTime: monotonicTime - 10,
        endTime: monotonicTime + 20,
      };
      emit(httpEntry);
      emit({ ...httpEntry, id: 'nitro-http-canceled', error: 'Request canceled' });

      expect(calls).toEqual([
        { method: 'begin', args: [expect.objectContaining({ timestamp: wallTime - 10 })] },
        { method: 'headers', args: [expect.objectContaining({ timestamp: wallTime + 20 })] },
        { method: 'end', args: [expect.objectContaining({ timestamp: wallTime + 20 })] },
        { method: 'begin', args: [expect.objectContaining({ timestamp: wallTime - 10 })] },
        { method: 'fail', args: ['Request canceled', true, wallTime + 20] },
      ]);

      const events: Array<{ type: string; timestamp: number }> = [];
      for (const type of [
        'websocket-connect',
        'websocket-open',
        'websocket-message-sent',
        'websocket-message-received',
        'websocket-error',
        'websocket-close',
      ] as const) {
        inspector.on(type, (event) =>
          events.push({ type: event.type, timestamp: event.timestamp }),
        );
      }
      const socketEntry = {
        id: 'nitro-ws-clock',
        type: 'websocket',
        url: 'wss://example.com/socket',
        protocols: [],
        readyState: 'OPEN',
        startTime: monotonicTime - 10,
        endTime: 0,
        messages: [
          { direction: 'sent', data: 'ping', isBinary: false, timestamp: monotonicTime - 5 },
          { direction: 'received', data: 'pong', isBinary: false, timestamp: monotonicTime + 5 },
        ],
      };
      emit(socketEntry);
      emit({
        ...socketEntry,
        readyState: 'CLOSED',
        endTime: monotonicTime + 20,
        error: 'Connection closed',
        closeCode: 1006,
      });

      expect(events).toEqual([
        { type: 'websocket-connect', timestamp: wallTime - 10 },
        { type: 'websocket-open', timestamp: wallTime - 10 },
        { type: 'websocket-message-sent', timestamp: wallTime - 5 },
        { type: 'websocket-message-received', timestamp: wallTime + 5 },
        { type: 'websocket-error', timestamp: wallTime + 20 },
        { type: 'websocket-close', timestamp: wallTime + 20 },
      ]);
      inspector.dispose();
    },
  );
});
