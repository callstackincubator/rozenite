import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDaemonSession } from '../commands/agent/daemon-session.js';
import type { MetroTarget } from '../commands/agent/daemon-protocol.js';

const mocks = vi.hoisted(() => {
  const connectDevice = vi.fn();
  const disconnectDevice = vi.fn();
  const createAgentMessageHandler = vi.fn(() => ({
    connectDevice,
    disconnectDevice,
    getTools: () => [],
    callTool: vi.fn(),
    handleDeviceMessage: vi.fn(),
    captureReactDevToolsMessage: vi.fn(),
    captureConsoleMessage: vi.fn(),
  }));
  const extractConsoleMessage = vi.fn(() => null);
  const parseRozeniteBindingPayload = vi.fn(() => null);
  const resolveMetroTarget = vi.fn<() => Promise<MetroTarget>>();
  const sockets: MockWebSocket[] = [];

  class MockWebSocket {
    static readonly OPEN = 1;

    readyState = MockWebSocket.OPEN;
    private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    private onceListeners = new Map<string, Set<(...args: unknown[]) => void>>();

    constructor(public readonly url: string) {
      sockets.push(this);
    }

    once(event: string, listener: (...args: unknown[]) => void): this {
      const listeners = this.onceListeners.get(event) || new Set();
      listeners.add(listener);
      this.onceListeners.set(event, listeners);
      return this;
    }

    on(event: string, listener: (...args: unknown[]) => void): this {
      const listeners = this.listeners.get(event) || new Set();
      listeners.add(listener);
      this.listeners.set(event, listeners);
      return this;
    }

    send(_payload: string, cb?: (error?: Error) => void): void {
      cb?.();
    }

    close(): void {
      this.readyState = 3;
      this.emit('close');
    }

    emit(event: string, ...args: unknown[]): void {
      for (const listener of this.listeners.get(event) || []) {
        listener(...args);
      }

      const onceListeners = this.onceListeners.get(event) || new Set();
      this.onceListeners.delete(event);
      for (const listener of onceListeners) {
        listener(...args);
      }
    }
  }

  return {
    connectDevice,
    disconnectDevice,
    createAgentMessageHandler,
    extractConsoleMessage,
    parseRozeniteBindingPayload,
    resolveMetroTarget,
    sockets,
    MockWebSocket,
  };
});

vi.mock('@rozenite/middleware', () => ({
  agent: {
    createAgentMessageHandler: mocks.createAgentMessageHandler,
    extractConsoleMessage: mocks.extractConsoleMessage,
    parseRozeniteBindingPayload: mocks.parseRozeniteBindingPayload,
  },
}));

vi.mock('../commands/agent/metro-discovery.js', () => ({
  resolveMetroTarget: mocks.resolveMetroTarget,
}));

vi.mock('ws', () => ({
  default: mocks.MockWebSocket,
}));

afterEach(() => {
  mocks.sockets.length = 0;
  vi.clearAllMocks();
});

describe('agent daemon session', () => {
  it('stops and terminates itself when the websocket closes', async () => {
    mocks.resolveMetroTarget.mockResolvedValue({
      id: 'device-1',
      name: 'iPhone',
      appId: 'app.test',
      pageId: 'page-1',
      title: 'title',
      description: 'description',
      webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug',
    });

    const onTerminated = vi.fn();
    const session = createDaemonSession(
      'session-1',
      '127.0.0.1',
      8081,
      undefined,
      onTerminated,
    );

    const startPromise = session.start();
    await vi.waitFor(() => {
      expect(mocks.sockets).toHaveLength(1);
    });

    mocks.sockets[0].emit('open');
    await startPromise;

    expect(session.getInfo().status).toBe('connected');

    mocks.sockets[0].emit('close');
    await vi.waitFor(() => {
      expect(onTerminated).toHaveBeenCalledWith('session-1');
    });

    expect(session.getInfo().status).toBe('stopped');
    expect(mocks.resolveMetroTarget).toHaveBeenCalledTimes(1);
    expect(mocks.disconnectDevice).toHaveBeenCalledWith('device-1');
  });
});
