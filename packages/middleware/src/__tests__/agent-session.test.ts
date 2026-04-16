import type { MetroTarget } from '@rozenite/agent-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const RUNTIME_GLOBAL = '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__';

type MockService = {
  getTools: ReturnType<typeof vi.fn>;
  callTool: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  onDisconnected: ReturnType<typeof vi.fn>;
  captureReactDevToolsMessage?: ReturnType<typeof vi.fn>;
};

const mocks = vi.hoisted(() => {
  const commandLog: Array<{
    method: string;
    params?: Record<string, unknown>;
  }> = [];
  const loggerInfo = vi.fn();
  const loggerWarn = vi.fn();
  const loggerDebug = vi.fn();
  const handler = {
    connectDevice: vi.fn(),
    disconnectDevice: vi.fn(),
    handleDeviceMessage: vi.fn(),
    captureConsoleMessage: vi.fn(),
    getTools: vi.fn(() => []),
    callTool: vi.fn(),
  };
  const services: MockService[] = Array.from({ length: 4 }, () => ({
    getTools: vi.fn(() => []),
    callTool: vi.fn(async () => undefined),
    dispose: vi.fn(async () => undefined),
    onDisconnected: vi.fn(),
    captureReactDevToolsMessage: vi.fn(),
  }));
  const wsInstances: MockWebSocket[] = [];
  let bindingName = 'rozenite-binding';

  class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    readonly url: string;
    readyState = MockWebSocket.CONNECTING;
    private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

    constructor(url: string) {
      this.url = url;
      wsInstances.push(this);
    }

    on(event: string, listener: (...args: unknown[]) => void) {
      const eventListeners = this.listeners.get(event) ?? new Set();
      eventListeners.add(listener);
      this.listeners.set(event, eventListeners);
      return this;
    }

    once(event: string, listener: (...args: unknown[]) => void) {
      const wrappedListener = (...args: unknown[]) => {
        this.off(event, wrappedListener);
        listener(...args);
      };

      return this.on(event, wrappedListener);
    }

    off(event: string, listener: (...args: unknown[]) => void) {
      this.listeners.get(event)?.delete(listener);
      return this;
    }

    emit(event: string, ...args: unknown[]) {
      this.listeners.get(event)?.forEach((listener) => {
        listener(...args);
      });
      return true;
    }

    send = vi.fn((rawPayload: string, callback?: (error?: Error) => void) => {
      const payload = JSON.parse(rawPayload) as {
        id: number;
        method: string;
        params?: Record<string, unknown>;
      };

      commandLog.push({
        method: payload.method,
        params: payload.params,
      });
      callback?.();

      queueMicrotask(() => {
        this.emit(
          'message',
          JSON.stringify({
            id: payload.id,
            result: getCommandResult(payload.method, payload.params),
          }),
        );
      });
    });

    close = vi.fn(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.emit('close');
    });

    open() {
      this.readyState = MockWebSocket.OPEN;
      this.emit('open');
    }
  }

  const getCommandResult = (
    method: string,
    params?: Record<string, unknown>,
  ) => {
    if (method !== 'Runtime.evaluate') {
      return {};
    }

    const expression = String(params?.expression ?? '');

    if (expression.includes(`globalThis.${RUNTIME_GLOBAL} != undefined`)) {
      return {
        result: {
          value: true,
        },
      };
    }

    if (expression.includes(`${RUNTIME_GLOBAL}.BINDING_NAME`)) {
      return {
        result: {
          value: bindingName,
        },
      };
    }

    return {};
  };

  return {
    commandLog,
    loggerInfo,
    loggerWarn,
    loggerDebug,
    MockWebSocket,
    handler,
    createAgentMessageHandler: vi.fn(() => handler),
    createAgentArtifacts: vi.fn(() => ({
      createWriter: vi.fn(),
    })),
    createReactDomainService: vi.fn(() => services[0]),
    createPerformanceDomainService: vi.fn(() => services[1]),
    createMemoryDomainService: vi.fn(() => services[2]),
    createNetworkDomainService: vi.fn(() => services[3]),
    extractConsoleMessage: vi.fn(() => null),
    parseRozeniteBindingPayload: vi.fn(() => null),
    wsInstances,
    reset: () => {
      commandLog.length = 0;
      loggerInfo.mockReset();
      loggerWarn.mockReset();
      loggerDebug.mockReset();
      handler.connectDevice.mockReset();
      handler.disconnectDevice.mockReset();
      handler.handleDeviceMessage.mockReset();
      handler.captureConsoleMessage.mockReset();
      handler.getTools.mockClear();
      handler.callTool.mockReset();
      services.forEach((service) => {
        service.getTools.mockClear();
        service.callTool.mockReset();
        service.dispose.mockReset();
        service.onDisconnected.mockReset();
        service.captureReactDevToolsMessage?.mockReset();
      });
      bindingName = 'rozenite-binding';
      wsInstances.length = 0;
    },
  };
});

vi.mock('ws', () => ({
  default: mocks.MockWebSocket,
}));

vi.mock('../agent/runtime/handler.js', () => ({
  createAgentMessageHandler: mocks.createAgentMessageHandler,
}));

vi.mock('../agent/artifacts.js', () => ({
  createAgentArtifacts: mocks.createAgentArtifacts,
}));

vi.mock('../agent/local-domains.js', () => ({
  createReactDomainService: mocks.createReactDomainService,
  createPerformanceDomainService: mocks.createPerformanceDomainService,
  createMemoryDomainService: mocks.createMemoryDomainService,
  createNetworkDomainService: mocks.createNetworkDomainService,
}));

vi.mock('../agent/runtime/console/extract.js', () => ({
  extractConsoleMessage: mocks.extractConsoleMessage,
}));

vi.mock('../agent/runtime/bindings.js', () => ({
  parseRozeniteBindingPayload: mocks.parseRozeniteBindingPayload,
}));

vi.mock('../logger.js', () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    debug: mocks.loggerDebug,
  },
}));

import { createAgentSession } from '../agent/session.js';

const TARGET: MetroTarget = {
  id: 'device-1',
  pageId: 'page-1',
  appId: 'com.example.app',
  name: 'iPhone 16',
  title: 'App',
  description: 'Device target',
  webSocketDebuggerUrl: 'ws://localhost:8081/debug',
};

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const createStartedSession = (
  overrides?: Partial<{
    cliVersion: string;
    metroVersion: string;
  }>,
) => {
  const session = createAgentSession({
    projectRoot: '/app',
    host: 'localhost',
    port: 8081,
    target: TARGET,
    ...overrides,
  });

  const startPromise = session.start();
  const socket = mocks.wsInstances[0];

  return { session, socket, startPromise };
};

const startSession = async (
  overrides?: Partial<{
    cliVersion: string;
    metroVersion: string;
  }>,
) => {
  const started = createStartedSession(overrides);
  started.socket.open();
  await vi.advanceTimersByTimeAsync(500);
  await vi.advanceTimersByTimeAsync(50);
  await flushMicrotasks();
  await started.startPromise;

  return { session: started.session, socket: started.socket };
};

const bootstrapSession = async () => {
  return await startSession();
};

const getExpressions = (): string[] => {
  return mocks.commandLog
    .filter((command) => command.method === 'Runtime.evaluate')
    .map((command) => String(command.params?.expression ?? ''));
};

const emitRozeniteBindingPayload = async (
  socket: InstanceType<typeof mocks.MockWebSocket>,
  message: Record<string, unknown>,
) => {
  mocks.parseRozeniteBindingPayload.mockImplementation(
    (((rawMessage: Record<string, unknown>) =>
      (rawMessage.bindingPayload as
        | {
            domain: string;
            message: Record<string, unknown>;
          }
        | undefined) ?? null) as unknown) as () => null,
  );

  socket.emit(
    'message',
    JSON.stringify({
      bindingPayload: {
        domain: 'rozenite',
        message,
      },
    }),
  );
  await flushMicrotasks();

  mocks.parseRozeniteBindingPayload.mockReset();
  mocks.parseRozeniteBindingPayload.mockReturnValue(null);
};

describe('agent session', () => {
  beforeEach(() => {
    mocks.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not resolve start before the bootstrap delay elapses', async () => {
    const { socket, startPromise } = createStartedSession();
    const onResolved = vi.fn();
    startPromise.then(onResolved);

    socket.open();
    await flushMicrotasks();
    expect(onResolved).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(499);
    await flushMicrotasks();
    expect(onResolved).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await flushMicrotasks();
    expect(onResolved).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();
    await startPromise;

    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it('resolves start after bootstrap and plugin readiness settles', async () => {
    const { startPromise, socket } = createStartedSession();
    const onResolved = vi.fn();
    startPromise.then(onResolved);

    socket.open();
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();

    expect(onResolved).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(49);
    await flushMicrotasks();
    expect(onResolved).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await flushMicrotasks();

    expect(onResolved).toHaveBeenCalledTimes(1);
    await expect(startPromise).resolves.toBeUndefined();

    const expressions = getExpressions();
    expect(
      expressions.some((expression) =>
        expression.includes('initializeDomain("react-devtools")'),
      ),
    ).toBe(true);
  });

  it('extends plugin readiness wait when activity arrives', async () => {
    const { startPromise, socket } = createStartedSession();
    const onResolved = vi.fn();
    startPromise.then(onResolved);

    socket.open();
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(49);
    await flushMicrotasks();

    await emitRozeniteBindingPayload(socket, {
      pluginId: '@rozenite/storage-plugin',
      type: 'plugin-mounted',
      payload: {
        pluginId: '@rozenite/storage-plugin',
      },
    });

    expect(onResolved).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(49);
    await flushMicrotasks();
    expect(onResolved).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await flushMicrotasks();
    await expect(startPromise).resolves.toBeUndefined();
  });

  it('resolves start after the bounded plugin readiness timeout', async () => {
    const { startPromise, socket } = createStartedSession();
    const onResolved = vi.fn();
    startPromise.then(onResolved);

    socket.open();
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();

    for (let elapsed = 0; elapsed < 245; elapsed += 49) {
      await vi.advanceTimersByTimeAsync(49);
      await flushMicrotasks();
      await emitRozeniteBindingPayload(socket, {
        pluginId: '@rozenite/storage-plugin',
        type: 'plugin-mounted',
        payload: {
          pluginId: '@rozenite/storage-plugin',
        },
      });
      expect(onResolved).not.toHaveBeenCalled();
    }

    await vi.advanceTimersByTimeAsync(5);
    await flushMicrotasks();
    await expect(startPromise).resolves.toBeUndefined();
  });

  it('emits agent-session-ready after rozenite domain initialization', async () => {
    await bootstrapSession();

    const expressions = getExpressions();
    const rozeniteIndex = expressions.findIndex((expression) =>
      expression.includes('initializeDomain("rozenite")'),
    );
    const readyIndex = expressions.findIndex(
      (expression) =>
        expression.includes('sendMessage("rozenite"') &&
        expression.includes('agent-session-ready'),
    );
    const reactDevToolsIndex = expressions.findIndex((expression) =>
      expression.includes('initializeDomain("react-devtools")'),
    );

    expect(rozeniteIndex).toBeGreaterThanOrEqual(0);
    expect(readyIndex).toBeGreaterThan(rozeniteIndex);
    expect(reactDevToolsIndex).toBeGreaterThan(readyIndex);
  });

  it('emits agent-session-ready again when bootstrap reruns', async () => {
    const { socket } = await bootstrapSession();

    socket.emit(
      'message',
      JSON.stringify({
        method: 'Runtime.executionContextCreated',
        params: {
          context: {
            name: 'main',
          },
        },
      }),
    );

    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();

    const readyExpressions = getExpressions().filter(
      (expression) =>
        expression.includes('sendMessage("rozenite"') &&
        expression.includes('agent-session-ready'),
    );

    expect(readyExpressions).toHaveLength(2);
  });

  it('logs when the agent session websocket connects', async () => {
    await startSession();

    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      'Rozenite for Agents connected to device iPhone 16 (device-1).',
    );
  });

  it('warns when the connected CLI version differs from Metro', async () => {
    await startSession({ cliVersion: '1.5.0', metroVersion: '1.6.0' });

    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Connected Rozenite agent uses version 1.5.0, but Metro is running version 1.6.0. Integration may not work correctly.',
    );
  });

  it('does not warn when the connected CLI version matches Metro', async () => {
    await startSession({ cliVersion: '1.6.0', metroVersion: '1.6.0' });

    expect(mocks.loggerWarn).not.toHaveBeenCalled();
  });

  it('logs when the session is stopped', async () => {
    const { session } = await startSession();

    await session.stop();

    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      'Rozenite for Agents disconnected from device iPhone 16 (device-1).',
    );
  });

  it('logs when the websocket closes', async () => {
    const { socket } = await startSession();

    socket.close();
    await flushMicrotasks();

    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      'Rozenite for Agents disconnected from device iPhone 16 (device-1).',
    );
  });

  it('rejects startup if the websocket closes before bootstrap completes', async () => {
    const { socket, startPromise } = createStartedSession();

    socket.open();
    await flushMicrotasks();

    const rejection = expect(startPromise).rejects.toThrow(
      'CDP connection closed before bootstrap completed',
    );

    socket.close();
    await rejection;
  });
});
