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
  const createReactTreeStore = vi.fn(() => ({
    registerDevice: vi.fn(),
    unregisterDevice: vi.fn(),
    ingestReactDevToolsMessage: vi.fn(async () => {}),
    getNode: vi.fn(),
    getChildren: vi.fn(),
    getProps: vi.fn(),
    getState: vi.fn(),
    getHooks: vi.fn(),
    searchNodes: vi.fn(),
    startProfiling: vi.fn(),
    isProfilingStarted: vi.fn(),
    stopProfiling: vi.fn(),
    getRenderData: vi.fn(),
  }));
  const extractConsoleMessage = vi.fn(() => null);
  const parseRozeniteBindingPayload = vi.fn(() => null);
  const resolveMetroTarget = vi.fn<() => Promise<MetroTarget>>();
  const sockets: MockWebSocket[] = [];
  const sentCommands: Array<{ id: number; method: string; params?: Record<string, unknown> }> = [];

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

    send(payload: string, cb?: (error?: Error) => void): void {
      const parsed = JSON.parse(payload) as {
        id?: number;
        method?: string;
        params?: Record<string, unknown>;
      };
      if (typeof parsed.id === 'number' && typeof parsed.method === 'string') {
        sentCommands.push({
          id: parsed.id,
          method: parsed.method,
          ...(parsed.params ? { params: parsed.params } : {}),
        });
      }
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
    createReactTreeStore,
    extractConsoleMessage,
    parseRozeniteBindingPayload,
    resolveMetroTarget,
    sockets,
    sentCommands,
    MockWebSocket,
  };
});

vi.mock('../commands/agent/runtime/handler.js', () => ({
  createAgentMessageHandler: mocks.createAgentMessageHandler,
}));

vi.mock('../commands/agent/runtime/react/store.js', () => ({
  createReactTreeStore: mocks.createReactTreeStore,
}));

vi.mock('../commands/agent/runtime/console/extract.js', () => ({
  extractConsoleMessage: mocks.extractConsoleMessage,
}));

vi.mock('../commands/agent/runtime/bindings.js', () => ({
  parseRozeniteBindingPayload: mocks.parseRozeniteBindingPayload,
}));

vi.mock('../commands/agent/metro-discovery.js', () => ({
  resolveMetroTarget: mocks.resolveMetroTarget,
}));

vi.mock('ws', () => ({
  default: mocks.MockWebSocket,
}));

afterEach(() => {
  vi.useRealTimers();
  mocks.sockets.length = 0;
  mocks.sentCommands.length = 0;
  vi.clearAllMocks();
});

const respondToCommand = (
  socket: InstanceType<typeof mocks.MockWebSocket>,
  method: string,
  response: Record<string, unknown> = {},
): void => {
  const command = mocks.sentCommands.find((entry) => entry.method === method);
  expect(command).toBeDefined();
  socket.emit('message', JSON.stringify({
    id: command!.id,
    result: response,
  }));
};

const respondToLatestCommand = (
  socket: InstanceType<typeof mocks.MockWebSocket>,
  method: string,
  response: Record<string, unknown> = {},
): void => {
  const commands = mocks.sentCommands.filter((entry) => entry.method === method);
  expect(commands.length).toBeGreaterThan(0);
  const command = commands[commands.length - 1];
  socket.emit('message', JSON.stringify({
    id: command.id,
    result: response,
  }));
};

const rejectCommand = (
  socket: InstanceType<typeof mocks.MockWebSocket>,
  method: string,
  error: Record<string, unknown>,
): void => {
  const command = mocks.sentCommands.find((entry) => entry.method === method);
  expect(command).toBeDefined();
  socket.emit('message', JSON.stringify({
    id: command!.id,
    error,
  }));
};

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
    await vi.waitFor(() => {
      expect(mocks.sentCommands.map((command) => command.method)).toEqual([
        'ReactNativeApplication.enable',
      ]);
    });
    respondToCommand(mocks.sockets[0], 'ReactNativeApplication.enable');
    await vi.waitFor(() => {
      expect(mocks.sentCommands.map((command) => command.method)).toEqual([
        'ReactNativeApplication.enable',
        'Runtime.enable',
      ]);
    });
    respondToCommand(mocks.sockets[0], 'Runtime.enable');
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

  it('routes react-devtools binding payloads into the local react domain service', async () => {
    mocks.resolveMetroTarget.mockResolvedValue({
      id: 'device-1',
      name: 'iPhone',
      appId: 'app.test',
      pageId: 'page-1',
      title: 'title',
      description: 'description',
      webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug',
    });
    mocks.parseRozeniteBindingPayload.mockReturnValue({
      domain: 'react-devtools',
      message: {
        event: 'profilingStatus',
        payload: true,
      },
    } as never);

    const session = createDaemonSession('session-1', '127.0.0.1', 8081);
    const startPromise = session.start();
    await vi.waitFor(() => {
      expect(mocks.sockets).toHaveLength(1);
    });

    mocks.sockets[0].emit('open');
    await vi.waitFor(() => {
      expect(mocks.sentCommands.map((command) => command.method)).toEqual([
        'ReactNativeApplication.enable',
      ]);
    });
    respondToCommand(mocks.sockets[0], 'ReactNativeApplication.enable');
    await vi.waitFor(() => {
      expect(mocks.sentCommands.map((command) => command.method)).toEqual([
        'ReactNativeApplication.enable',
        'Runtime.enable',
      ]);
    });
    respondToCommand(mocks.sockets[0], 'Runtime.enable');
    await startPromise;

    mocks.sockets[0].emit('message', JSON.stringify({
      method: 'Runtime.bindingCalled',
      params: {
        payload: '{"domain":"react-devtools","message":{"event":"profilingStatus","payload":true}}',
      },
    }));

    const reactStore = mocks.createReactTreeStore.mock.results[0]?.value;
    await vi.waitFor(() => {
      expect(reactStore.ingestReactDevToolsMessage).toHaveBeenCalledWith(
        'react-session:session-1',
        {
          event: 'profilingStatus',
          payload: true,
        },
      );
    });
  });

  it('sends the Fusebox handshake before runtime enable and proceeds with startup', async () => {
    vi.useFakeTimers();
    mocks.resolveMetroTarget.mockResolvedValue({
      id: 'device-1',
      name: 'iPhone',
      appId: 'app.test',
      pageId: 'page-1',
      title: 'title',
      description: 'description',
      webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug',
    });

    const session = createDaemonSession('session-1', '127.0.0.1', 8081);
    const startPromise = session.start();
    await vi.waitFor(() => {
      expect(mocks.sockets).toHaveLength(1);
    });

    mocks.sockets[0].emit('open');
    await vi.waitFor(() => {
      expect(mocks.sentCommands.map((command) => command.method)).toEqual([
        'ReactNativeApplication.enable',
      ]);
    });

    respondToCommand(mocks.sockets[0], 'ReactNativeApplication.enable');
    await vi.waitFor(() => {
      expect(mocks.sentCommands.map((command) => command.method)).toEqual([
        'ReactNativeApplication.enable',
        'Runtime.enable',
      ]);
    });

    respondToCommand(mocks.sockets[0], 'Runtime.enable');
    await startPromise;

    await vi.advanceTimersByTimeAsync(500);

    expect(mocks.sentCommands.map((command) => command.method)).toContain('Runtime.evaluate');
    vi.useRealTimers();
  });

  it('unwraps Runtime.evaluate results during delayed bootstrap', async () => {
    vi.useFakeTimers();
    mocks.resolveMetroTarget.mockResolvedValue({
      id: 'device-1',
      name: 'iPhone',
      appId: 'app.test',
      pageId: 'page-1',
      title: 'title',
      description: 'description',
      webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug',
    });

    const session = createDaemonSession('session-1', '127.0.0.1', 8081);
    const startPromise = session.start();
    await vi.waitFor(() => {
      expect(mocks.sockets).toHaveLength(1);
    });

    mocks.sockets[0].emit('open');
    respondToCommand(mocks.sockets[0], 'ReactNativeApplication.enable');
    await vi.waitFor(() => {
      expect(mocks.sentCommands.map((command) => command.method)).toContain('Runtime.enable');
    });
    respondToCommand(mocks.sockets[0], 'Runtime.enable');
    await startPromise;

    await vi.advanceTimersByTimeAsync(500);
    await vi.waitFor(() => {
      expect(mocks.sentCommands.filter((command) => command.method === 'Runtime.evaluate').length).toBeGreaterThan(0);
    });
    respondToLatestCommand(mocks.sockets[0], 'Runtime.evaluate', {
      result: { value: true },
    });

    await vi.waitFor(() => {
      expect(mocks.sentCommands.filter((command) => command.method === 'Runtime.evaluate').length).toBeGreaterThan(1);
    });
    respondToLatestCommand(mocks.sockets[0], 'Runtime.evaluate', {
      result: { value: 'fusebox-binding' },
    });

    await vi.waitFor(() => {
      expect(mocks.sentCommands.map((command) => command.method)).toContain('Runtime.addBinding');
    });
    respondToCommand(mocks.sockets[0], 'Runtime.addBinding');

    await vi.waitFor(() => {
      expect(
        mocks.sentCommands.filter(
          (command) => command.method === 'Runtime.evaluate'
            && command.params?.expression === 'void __FUSEBOX_REACT_DEVTOOLS_DISPATCHER__.initializeDomain("rozenite")',
        ).length,
      ).toBe(1);
    });
  });

  it('fails session startup when the Fusebox handshake is rejected', async () => {
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
    await vi.waitFor(() => {
      expect(mocks.sentCommands.map((command) => command.method)).toEqual([
        'ReactNativeApplication.enable',
      ]);
    });

    rejectCommand(mocks.sockets[0], 'ReactNativeApplication.enable', {
      code: -32601,
      message: 'Method not found',
    });

    await expect(startPromise).rejects.toThrow('Method not found');
    expect(mocks.sentCommands.map((command) => command.method)).not.toContain('Runtime.enable');
    expect(session.getInfo().status).toBe('stopped');
    expect(session.getInfo().lastError).toContain('Method not found');
    await vi.waitFor(() => {
      expect(onTerminated).toHaveBeenCalledWith('session-1');
    });
  });
});
