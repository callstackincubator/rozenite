import { describe, expect, it } from 'vitest';
import { createNetworkActivityAgentState } from '../state';
import { networkActivityToolDefinitions } from '../../../shared/agent-tools';
import type { Request } from '../../../shared/client';

const createRequest = (overrides?: Partial<Request>): Request => ({
  url: 'https://example.com/api',
  method: 'POST',
  headers: {
    'content-type': 'application/json',
  },
  postData: {
    type: 'text',
    value: '{"hello":"world"}',
  },
  ...overrides,
});

describe('network activity agent state', () => {
  it('exposes the expected fallback and realtime tool names', () => {
    expect(
      Object.values(networkActivityToolDefinitions).map((tool) => tool.name),
    ).toEqual([
      'startRecording',
      'stopRecording',
      'getRecordingStatus',
      'listRequests',
      'getRequestDetails',
      'getRequestBody',
      'getResponseBody',
      'listRealtimeConnections',
      'getRealtimeConnectionDetails',
    ]);
    expect(
      networkActivityToolDefinitions.getRequestDetails.inputSchema.required,
    ).toEqual(['requestId']);
  });

  it('tracks HTTP requests with parity-oriented list/detail/body results', () => {
    const state = createNetworkActivityAgentState();
    state.startRecording();

    state.onRequestSent({
      requestId: 'req-1',
      timestamp: 100,
      request: createRequest(),
      type: 'XHR',
      initiator: { type: 'script', url: 'App.tsx', lineNumber: 12, columnNumber: 4 },
    });
    state.onResponseReceived({
      requestId: 'req-1',
      timestamp: 120,
      type: 'XHR',
      response: {
        url: 'https://example.com/api',
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        contentType: 'application/json',
        size: 17,
        responseTime: 120,
      },
    });
    state.onRequestCompleted({
      requestId: 'req-1',
      timestamp: 130,
      duration: 30,
      size: 17,
      ttfb: 20,
    });

    const list = state.listRequests({});
    expect(list.items).toEqual([
      {
        requestId: 'req-1',
        method: 'POST',
        url: 'https://example.com/api',
        status: 200,
        type: 'XHR',
        startTimeMs: 100,
        endTimeMs: 130,
        durationMs: 30,
        transferSize: 17,
        encodedDataLength: 17,
        outcome: 'success',
      },
    ]);

    const details = state.getRequestDetails('req-1');
    expect(details.request).toMatchObject({
      requestId: 'req-1',
      method: 'POST',
      url: 'https://example.com/api',
      type: 'XHR',
      loadingFinished: true,
      loadingFailed: false,
      ttfb: 20,
      size: 17,
    });

    expect(state.getRequestBody('req-1')).toEqual({
      requestId: 'req-1',
      available: true,
      body: '{"hello":"world"}',
      base64Encoded: false,
    });
  });

  it('returns unavailable request bodies when none were captured', () => {
    const state = createNetworkActivityAgentState();
    state.startRecording();
    state.onRequestSent({
      requestId: 'req-2',
      timestamp: 10,
      request: createRequest({ postData: undefined, method: 'GET' }),
      type: 'Fetch',
      initiator: { type: 'other' },
    });

    expect(state.getRequestBody('req-2')).toEqual({
      requestId: 'req-2',
      available: false,
      reason: 'No request body is available for this request.',
    });
  });

  it('supports realtime listing and details for websocket and sse traffic', () => {
    const state = createNetworkActivityAgentState();
    state.startRecording();

    state.onWebSocketConnect({
      type: 'websocket-connect',
      url: 'wss://example.com/socket',
      socketId: 7,
      timestamp: 100,
      protocols: ['chat'],
      options: [],
    });
    state.onWebSocketOpen({
      type: 'websocket-open',
      url: 'wss://example.com/socket',
      socketId: 7,
      timestamp: 110,
    });
    state.onWebSocketMessageSent({
      type: 'websocket-message-sent',
      url: 'wss://example.com/socket',
      socketId: 7,
      timestamp: 120,
      data: 'ping',
      messageType: 'text',
    });
    state.onWebSocketMessageReceived({
      type: 'websocket-message-received',
      url: 'wss://example.com/socket',
      socketId: 7,
      timestamp: 121,
      data: 'pong',
      messageType: 'text',
    });

    state.onRequestSent({
      requestId: 'req-sse',
      timestamp: 200,
      request: createRequest({
        method: 'GET',
        url: 'https://example.com/stream',
        postData: undefined,
      }),
      type: 'Fetch',
      initiator: { type: 'script' },
    });
    state.onSSEOpen({
      type: 'sse-open',
      requestId: 'req-sse',
      timestamp: 210,
      response: {
        url: 'https://example.com/stream',
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/event-stream' },
        contentType: 'text/event-stream',
        size: 0,
        responseTime: 210,
      },
    });
    state.onSSEMessage({
      type: 'sse-message',
      requestId: 'req-sse',
      timestamp: 220,
      payload: {
        type: 'message',
        data: 'hello',
      },
    });

    const list = state.listRealtimeConnections({});
    expect(list.items).toHaveLength(2);
    expect(list.items[0]).toMatchObject({
      requestId: 'req-sse',
      kind: 'sse',
      status: 'open',
      messageCount: 1,
    });
    expect(list.items[1]).toMatchObject({
      requestId: 'ws-7',
      kind: 'websocket',
      status: 'open',
      messageCount: 2,
    });

    const websocketDetails = state.getRealtimeConnectionDetails('ws-7');
    expect(websocketDetails.connection).toMatchObject({
      requestId: 'ws-7',
      kind: 'websocket',
      url: 'wss://example.com/socket',
      status: 'open',
    });
    expect(websocketDetails.connection.messages).toHaveLength(2);

    const sseDetails = state.getRealtimeConnectionDetails('req-sse');
    expect(sseDetails.connection).toMatchObject({
      requestId: 'req-sse',
      kind: 'sse',
      status: 'open',
    });
    expect(sseDetails.connection.messages).toHaveLength(1);
  });

  it('invalidates old cursors after a new recording starts', () => {
    const state = createNetworkActivityAgentState();
    state.startRecording();
    state.onRequestSent({
      requestId: 'req-1',
      timestamp: 100,
      request: createRequest(),
      type: 'XHR',
      initiator: { type: 'other' },
    });
    state.onRequestSent({
      requestId: 'req-2',
      timestamp: 101,
      request: createRequest({ url: 'https://example.com/api/2' }),
      type: 'XHR',
      initiator: { type: 'other' },
    });

    const firstPage = state.listRequests({ limit: 1 });
    state.startRecording();

    expect(() =>
      state.listRequests({ limit: 1, cursor: firstPage.page.nextCursor })
    ).toThrow('Cursor does not match the requested listing. Run the command again.');
  });
});
