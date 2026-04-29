import { describe, expect, it, vi } from 'vitest';

vi.mock('../websocket-interceptor', () => ({
  getWebSocketInterceptor: vi.fn(),
}));

import { createWebSocketInspector } from '../websocket-inspector';
import type { WebSocketInterceptor } from '../websocket-interceptor';

const createInterceptor = () => {
  const callbacks: Partial<{
    connect: Parameters<WebSocketInterceptor['setConnectCallback']>[0];
    open: Parameters<WebSocketInterceptor['setOnOpenCallback']>[0];
    message: Parameters<WebSocketInterceptor['setOnMessageCallback']>[0];
  }> = {};

  const interceptor: WebSocketInterceptor = {
    setCloseCallback: vi.fn(),
    setSendCallback: vi.fn(),
    setConnectCallback: vi.fn((callback) => {
      callbacks.connect = callback;
    }),
    setOnOpenCallback: vi.fn((callback) => {
      callbacks.open = callback;
    }),
    setOnMessageCallback: vi.fn((callback) => {
      callbacks.message = callback;
    }),
    setOnErrorCallback: vi.fn(),
    setOnCloseCallback: vi.fn(),
    isInterceptorEnabled: vi.fn(() => true),
    enableInterception: vi.fn(),
    disableInterception: vi.fn(),
  };

  return {
    callbacks,
    interceptor,
  };
};

describe('websocket inspector', () => {
  it('stringifies numeric interceptor ids before emitting events', () => {
    const { callbacks, interceptor } = createInterceptor();
    const inspector = createWebSocketInspector(interceptor);
    const events: Array<{ type: string; socketId: string }> = [];

    inspector.on('websocket-connect', (event) => {
      events.push({ type: event.type, socketId: event.socketId });
    });
    inspector.on('websocket-open', (event) => {
      events.push({ type: event.type, socketId: event.socketId });
    });
    inspector.on('websocket-message-received', (event) => {
      events.push({ type: event.type, socketId: event.socketId });
    });

    inspector.enable();
    callbacks.connect?.('wss://example.com/socket', ['chat'], [], 42);
    callbacks.open?.(42);
    callbacks.message?.('hello', 42);

    expect(events).toEqual([
      { type: 'websocket-connect', socketId: '42' },
      { type: 'websocket-open', socketId: '42' },
      { type: 'websocket-message-received', socketId: '42' },
    ]);
  });
});
