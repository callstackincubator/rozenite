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
  const loggerError = vi.fn();
  const handler = {
    connectDevice: vi.fn(),
    disconnectDevice: vi.fn(),
    handleDeviceMessage: vi.fn(),
    captureConsoleMessage: vi.fn(),
    getTools: vi.fn(() => []),
    getRegisteredPluginTools: vi.fn(() => []),
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
  let stalledRuntimeExpression: string | null = null;
  let stalledCallFunctionOn = false;
  let forcedCallFunctionOnExceptionText: string | null = null;
  let forcedCallFunctionOnProtocolError: string | null = null;
  let forcedCallFunctionOnMessageError: string | null = null;

  class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    readonly url: string;
    readonly options: unknown;
    readyState = MockWebSocket.CONNECTING;
    private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

    constructor(url: string, options?: unknown) {
      this.url = url;
      this.options = options;
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

      if (payload.method === 'Runtime.callFunctionOn' && forcedCallFunctionOnProtocolError) {
        callback?.(new Error(forcedCallFunctionOnProtocolError));
        return;
      }

      callback?.();

      if (
        payload.method === 'Runtime.evaluate' &&
        stalledRuntimeExpression &&
        String(payload.params?.expression ?? '').includes(stalledRuntimeExpression)
      ) {
        return;
      }

      if (payload.method === 'Runtime.callFunctionOn' && stalledCallFunctionOn) {
        return;
      }

      queueMicrotask(() => {
        if (payload.method === 'Runtime.callFunctionOn' && forcedCallFunctionOnMessageError) {
          // A genuine CDP protocol-level error response
          // (`{"id": ..., "error": {...}}`), as opposed to a socket-write failure
          // or a successful response carrying `exceptionDetails`.
          this.emit(
            'message',
            JSON.stringify({
              id: payload.id,
              error: { message: forcedCallFunctionOnMessageError, code: -32000 },
            }),
          );
          return;
        }

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

  const getCommandResult = (method: string, params?: Record<string, unknown>) => {
    if (method === 'Runtime.callFunctionOn' && forcedCallFunctionOnExceptionText) {
      return {
        result: {},
        exceptionDetails: { text: forcedCallFunctionOnExceptionText },
      };
    }

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
    loggerError,
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
    stallRuntimeEvaluationContaining: (expression: string) => {
      stalledRuntimeExpression = expression;
    },
    stallCallFunctionOn: () => {
      stalledCallFunctionOn = true;
    },
    forceCallFunctionOnException: (text: string | null) => {
      forcedCallFunctionOnExceptionText = text;
    },
    forceCallFunctionOnProtocolError: (message: string | null) => {
      forcedCallFunctionOnProtocolError = message;
    },
    forceCallFunctionOnMessageError: (message: string | null) => {
      forcedCallFunctionOnMessageError = message;
    },
    reset: () => {
      commandLog.length = 0;
      loggerInfo.mockReset();
      loggerWarn.mockReset();
      loggerDebug.mockReset();
      loggerError.mockReset();
      stalledCallFunctionOn = false;
      forcedCallFunctionOnExceptionText = null;
      forcedCallFunctionOnProtocolError = null;
      forcedCallFunctionOnMessageError = null;
      handler.connectDevice.mockReset();
      handler.disconnectDevice.mockReset();
      handler.handleDeviceMessage.mockReset();
      handler.captureConsoleMessage.mockReset();
      handler.getTools.mockClear();
      handler.getRegisteredPluginTools.mockClear();
      handler.callTool.mockReset();
      services.forEach((service) => {
        service.getTools.mockClear();
        service.callTool.mockReset();
        service.dispose.mockReset();
        service.onDisconnected.mockReset();
        service.captureReactDevToolsMessage?.mockReset();
      });
      bindingName = 'rozenite-binding';
      stalledRuntimeExpression = null;
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
    error: mocks.loggerError,
  },
}));

import { createAgentSession } from '../agent/session.js';

const createTarget = (overrides: Partial<MetroTarget> = {}): MetroTarget => ({
  id: 'device-1',
  pageId: 'page-1',
  appId: 'com.example.app',
  name: 'iPhone 16',
  title: 'App',
  description: 'Device target',
  webSocketDebuggerUrl: 'ws://localhost:8081/debug',
  ...overrides,
});

const TARGET = createTarget();

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const createStartedSession = (
  overrides?: Partial<{
    cliVersion: string;
    metroVersion: string;
    target: MetroTarget;
    resolveTarget: (deviceId: string) => Promise<MetroTarget>;
  }>,
) => {
  const session = createAgentSession({
    projectRoot: '/app',
    host: 'localhost',
    port: 8081,
    target: overrides?.target ?? TARGET,
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
    resolveTarget: (deviceId: string) => Promise<MetroTarget>;
  }>,
) => {
  const started = createStartedSession(overrides);
  started.socket.open();
  await vi.advanceTimersByTimeAsync(500);
  await emitRozeniteBindingPayload(started.socket, {
    pluginId: '@rozenite/test-plugin',
    type: 'register-tool',
    payload: {},
  });
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
    ((rawMessage: Record<string, unknown>) =>
      (rawMessage.bindingPayload as
        | {
            domain: string;
            message: Record<string, unknown>;
          }
        | undefined) ?? null) as unknown as () => null,
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

  it('sets an origin header derived from the debugger websocket URL', () => {
    const { socket } = createStartedSession();

    expect(socket.url).toBe(TARGET.webSocketDebuggerUrl);
    expect(socket.options).toEqual({
      headers: {
        Origin: 'http://localhost:8081',
      },
    });
  });

  it('preserves the debugger websocket host in the origin header', () => {
    const target = createTarget({
      webSocketDebuggerUrl: 'ws://127.0.0.1:8081/debug',
    });

    const { socket } = createStartedSession({ target });

    expect(socket.url).toBe(target.webSocketDebuggerUrl);
    expect(socket.options).toEqual({
      headers: {
        Origin: 'http://127.0.0.1:8081',
      },
    });
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
    await startPromise;

    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it('resolves start after bootstrap and plugin readiness settles', async () => {
    const { startPromise, socket } = createStartedSession();
    const onResolved = vi.fn();
    startPromise.then(onResolved, () => undefined);

    socket.open();
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();

    await flushMicrotasks();

    expect(onResolved).toHaveBeenCalledTimes(1);
    await expect(startPromise).resolves.toBeUndefined();

    const expressions = getExpressions();
    expect(
      expressions.some((expression) => expression.includes('initializeDomain("react-devtools")')),
    ).toBe(true);
  });

  it('extends plugin readiness wait when activity arrives', async () => {
    const { startPromise, socket } = createStartedSession();
    const onResolved = vi.fn();
    startPromise.then(onResolved, () => undefined);

    socket.open();
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(49);
    await flushMicrotasks();

    await emitRozeniteBindingPayload(socket, {
      pluginId: '@rozenite/storage-plugin',
      type: 'register-tool',
      payload: {
        pluginId: '@rozenite/storage-plugin',
      },
    });

    await expect(startPromise).resolves.toBeUndefined();
  });

  it('starts built-in-only sessions without plugin registration', async () => {
    const { startPromise, socket } = createStartedSession();
    const onResolved = vi.fn();
    startPromise.then(onResolved);

    socket.open();
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();

    await expect(startPromise).resolves.toBeUndefined();
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it('emits agent-session-ready after rozenite domain initialization', async () => {
    await bootstrapSession();

    const expressions = getExpressions();
    const rozeniteIndex = expressions.findIndex((expression) =>
      expression.includes('initializeDomain("rozenite")'),
    );
    const readyIndex = expressions.findIndex(
      (expression) =>
        expression.includes('sendMessage("rozenite"') && expression.includes('agent-session-ready'),
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
        expression.includes('sendMessage("rozenite"') && expression.includes('agent-session-ready'),
    );

    expect(readyExpressions).toHaveLength(2);
  });

  it('sends domain messages via Runtime.callFunctionOn with a single-stringified by-value argument once a main execution context id is known', async () => {
    const { socket } = await bootstrapSession();

    // Re-capture the main execution context id, as would happen on reload.
    socket.emit(
      'message',
      JSON.stringify({
        method: 'Runtime.executionContextCreated',
        params: { context: { name: 'main', id: 42 } },
      }),
    );
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();

    const callFunctionOnCommands = mocks.commandLog.filter(
      (command) => command.method === 'Runtime.callFunctionOn',
    );
    const readyCommand = callFunctionOnCommands.find((command) => {
      const args = command.params?.arguments as Array<{ value: unknown }> | undefined;
      return typeof args?.[0]?.value === 'string' && args[0].value.includes('agent-session-ready');
    });

    expect(readyCommand).toBeDefined();
    expect(readyCommand?.params?.executionContextId).toBe(42);
    expect(readyCommand?.params?.functionDeclaration).toContain('sendMessage("rozenite", m)');

    // The by-value argument must be the JSON string of the message -- a single
    // stringify, not the "stringify the stringified string" that `Runtime.evaluate`
    // needed to embed the payload into JS source text.
    const argValue = (readyCommand?.params?.arguments as Array<{ value: unknown }>)[0].value;
    expect(typeof argValue).toBe('string');
    const parsed = JSON.parse(argValue as string);
    expect(typeof parsed).toBe('object');
    expect(parsed).toMatchObject({ type: 'agent-session-ready' });

    // No more Runtime.evaluate-based sends for this domain once the context id
    // is known -- the legacy double-stringify path is no longer used.
    const readyExpressions = getExpressions().filter(
      (expression) =>
        expression.includes('sendMessage("rozenite"') && expression.includes('agent-session-ready'),
    );
    expect(readyExpressions).toHaveLength(1); // only the first send, before the id was known
  });

  it('reports a failed send instead of swallowing it, both for a runtime exception and a rejected command', async () => {
    const { socket } = await bootstrapSession();

    socket.emit(
      'message',
      JSON.stringify({
        method: 'Runtime.executionContextCreated',
        params: { context: { name: 'main', id: 7 } },
      }),
    );
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();
    mocks.loggerError.mockClear();

    // Case 1: the command succeeds at the protocol level but the evaluated
    // function throws (surfaced as `exceptionDetails`, exactly what `sendMessage`
    // silently ignored before this fix).
    mocks.forceCallFunctionOnException('stale execution context');

    socket.emit(
      'message',
      JSON.stringify({
        method: 'Runtime.executionContextCreated',
        params: { context: { name: 'main', id: 7 } },
      }),
    );
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.stringContaining('stale execution context'),
    );

    // Case 2: the underlying socket write itself fails outright (distinct from
    // case 3 below: this is `ws.send`'s own callback reporting an error, before
    // any CDP response is ever received).
    mocks.loggerError.mockClear();
    mocks.forceCallFunctionOnException(null); // clear case-1 forcing via exceptionDetails
    mocks.forceCallFunctionOnProtocolError('Cannot find context with specified id');

    socket.emit(
      'message',
      JSON.stringify({
        method: 'Runtime.executionContextCreated',
        params: { context: { name: 'main', id: 7 } },
      }),
    );
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.stringContaining('Cannot find context with specified id'),
    );

    // Case 3: the device replies with a genuine CDP protocol-level error
    // (`{"id": ..., "error": {...}}`) -- e.g. a stale execution context id the
    // device no longer recognizes after a reload. This is the path
    // `handleSocketMessage`'s `message.error` branch handles, distinct from both
    // cases above.
    mocks.loggerError.mockClear();
    mocks.forceCallFunctionOnProtocolError(null);
    mocks.forceCallFunctionOnMessageError('Cannot find context with specified id');

    socket.emit(
      'message',
      JSON.stringify({
        method: 'Runtime.executionContextCreated',
        params: { context: { name: 'main', id: 7 } },
      }),
    );
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.stringContaining('Cannot find context with specified id'),
    );
  });

  it('retries bootstrap when the agent-session-ready send fails', async () => {
    // `sendDomainMessage` no longer blocks the caller on the CDP round trip, but
    // `sendAgentSessionReady` still `await`s it -- a failed send must still
    // propagate so `bootstrap()`'s own retry logic (its `catch` calling
    // `scheduleBootstrap()`) keeps working, exactly as it did when this call was
    // fully awaited.
    const { socket } = await bootstrapSession();

    socket.emit(
      'message',
      JSON.stringify({
        method: 'Runtime.executionContextCreated',
        params: { context: { name: 'main', id: 7 } },
      }),
    );
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();

    const readySendsBefore = mocks.commandLog.filter(
      (command) =>
        command.method === 'Runtime.callFunctionOn' &&
        JSON.stringify(
          (command.params?.arguments as Array<{ value: unknown }> | undefined)?.[0]?.value,
        ).includes('agent-session-ready'),
    ).length;

    mocks.forceCallFunctionOnMessageError('Cannot find context with specified id');
    socket.emit(
      'message',
      JSON.stringify({
        method: 'Runtime.executionContextCreated',
        params: { context: { name: 'main', id: 7 } },
      }),
    );
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();

    // Stop forcing the failure and let the retried bootstrap succeed.
    mocks.forceCallFunctionOnMessageError(null);
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();

    const readySendsAfter = mocks.commandLog.filter(
      (command) =>
        command.method === 'Runtime.callFunctionOn' &&
        JSON.stringify(
          (command.params?.arguments as Array<{ value: unknown }> | undefined)?.[0]?.value,
        ).includes('agent-session-ready'),
    ).length;

    // More than one additional attempt: the failed send (which did not itself
    // reach the device) plus at least one retry that succeeded.
    expect(readySendsAfter).toBeGreaterThan(readySendsBefore + 1);
  });

  it('times out a pending CDP command instead of hanging forever', async () => {
    const { socket } = await bootstrapSession();
    mocks.stallCallFunctionOn();

    socket.emit(
      'message',
      JSON.stringify({
        method: 'Runtime.executionContextCreated',
        params: { context: { name: 'main', id: 7 } },
      }),
    );
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();

    const callFunctionOnCommand = mocks.commandLog.find(
      (command) => command.method === 'Runtime.callFunctionOn',
    );
    expect(callFunctionOnCommand).toBeDefined();
    mocks.loggerError.mockClear();

    // The command was sent but the device never responds -- without the pending
    // command timeout this would hang forever.
    await vi.advanceTimersByTimeAsync(10_000);
    await flushMicrotasks();

    expect(mocks.loggerError).toHaveBeenCalledWith(expect.stringContaining('timed out'));
  });

  it('does not time out CDP commands outside the message-send path', async () => {
    // The pending-command timeout exists specifically to bound the message-send
    // path (see the previous test) -- it must not apply to `sendCommand` in
    // general, or legitimately long-running commands (e.g.
    // `HeapProfiler.takeHeapSnapshot`, large `Network.getResponseBody` calls)
    // issued by the local domain services would be cut off after 10s.
    const { socket } = await bootstrapSession();

    // Stall an ordinary (non-message-send) `Runtime.evaluate` call -- the
    // dispatcher-liveness check bootstrap issues on every rerun -- standing in
    // for a slow, unrelated CDP command that must be allowed to run past the
    // send-path's timeout window without being rejected.
    mocks.stallRuntimeEvaluationContaining(`globalThis.${RUNTIME_GLOBAL}`);
    mocks.loggerError.mockClear();

    socket.emit('message', JSON.stringify({ method: 'Runtime.executionContextsCleared' }));
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();

    // Advance well past COMMAND_TIMEOUT_MS (10s): a scoped timeout would have
    // fired and rejected this pending command by now.
    await vi.advanceTimersByTimeAsync(15_000);
    await flushMicrotasks();

    expect(mocks.loggerError).not.toHaveBeenCalledWith(expect.stringContaining('timed out'));
  });

  it('heals a relaunched app with the same device id and a new page id', async () => {
    const replacementTarget = createTarget({
      pageId: 'page-2',
      webSocketDebuggerUrl: 'ws://localhost:8081/debug?page=2',
    });
    const resolveTarget = vi.fn().mockResolvedValue(replacementTarget);
    const { session, socket } = await startSession({ resolveTarget });

    socket.emit('close', 1000, Buffer.from('[RECREATING_DEVICE]'));
    await flushMicrotasks();

    expect(session.getInfo()).toMatchObject({ status: 'connecting' });
    expect(resolveTarget).toHaveBeenCalledWith('device-1');

    const replacementSocket = mocks.wsInstances[1];
    replacementSocket.open();
    await vi.advanceTimersByTimeAsync(500);
    await emitRozeniteBindingPayload(replacementSocket, {
      pluginId: '@rozenite/test-plugin',
      type: 'register-tool',
      payload: {},
    });
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();

    expect(session.getInfo()).toMatchObject({
      id: 'device-1',
      pageId: 'page-2',
      status: 'connected',
      healing: { outcome: 'recovered' },
    });
    expect(mocks.handler.disconnectDevice).toHaveBeenCalledWith('device-1');
    expect(mocks.handler.connectDevice).toHaveBeenCalledTimes(2);
  });

  it('heals PAGE_NOT_FOUND before the initial socket opens', async () => {
    const replacementTarget = createTarget({ pageId: 'page-2' });
    const { startPromise, socket } = createStartedSession({
      resolveTarget: vi.fn().mockResolvedValue(replacementTarget),
    });
    void startPromise.catch(() => undefined);

    socket.emit('close', 1000, Buffer.from('[PAGE_NOT_FOUND]'));
    await flushMicrotasks();
    const replacementSocket = mocks.wsInstances[1];
    replacementSocket.open();
    await vi.advanceTimersByTimeAsync(500);
    await emitRozeniteBindingPayload(replacementSocket, {
      pluginId: '@rozenite/test-plugin',
      type: 'register-tool',
      payload: {},
    });
    await vi.advanceTimersByTimeAsync(50);

    await expect(startPromise).resolves.toBeUndefined();
  });

  it('does not reconnect when React Native DevTools takes the connection', async () => {
    const resolveTarget = vi.fn();
    const { session, socket } = await startSession({ resolveTarget });

    socket.emit('close', 1000, Buffer.from('[NEW_DEBUGGER_OPENED]'));
    await flushMicrotasks();

    expect(resolveTarget).not.toHaveBeenCalled();
    expect(mocks.wsInstances).toHaveLength(1);
    expect(session.getInfo()).toMatchObject({
      status: 'stopped',
      healing: {
        outcome: 'blocked',
        message: 'React Native DevTools took the connection — close it and retry.',
      },
    });
  });

  it('cancels recovery when the session is stopped', async () => {
    let resolveTarget: ((target: MetroTarget) => void) | undefined;
    const targetPromise = new Promise<MetroTarget>((resolve) => {
      resolveTarget = resolve;
    });
    const { session, socket } = await startSession({
      resolveTarget: vi.fn().mockReturnValue(targetPromise),
    });

    socket.emit('close', 1000, Buffer.from('[CONNECTION_LOST]'));
    await flushMicrotasks();
    await session.stop();
    resolveTarget?.(createTarget({ pageId: 'page-2' }));
    await flushMicrotasks();

    expect(session.getInfo().status).toBe('stopped');
    expect(mocks.wsInstances).toHaveLength(1);
  });

  it('surfaces profiling state lost during a healed relaunch', async () => {
    const resolveTarget = vi.fn().mockResolvedValue(createTarget({ pageId: 'page-2' }));
    const { session, socket } = await startSession({ resolveTarget });
    await session.callTool('startProfiling', {});

    socket.emit('close', 1000, Buffer.from('[CONNECTION_LOST]'));
    await flushMicrotasks();
    const replacementSocket = mocks.wsInstances[1];
    replacementSocket.open();
    await vi.advanceTimersByTimeAsync(500);
    await emitRozeniteBindingPayload(replacementSocket, {
      pluginId: '@rozenite/test-plugin',
      type: 'register-tool',
      payload: {},
    });
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();

    await expect(session.callTool('stopProfiling', {})).rejects.toThrow(
      'AGENT_SESSION_STATE_LOST: profiling data was lost',
    );
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

  it('handles pending CDP command rejection for detached senders when the websocket closes', async () => {
    const unhandledRejections: unknown[] = [];
    const handleUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason);
    };
    process.on('unhandledRejection', handleUnhandledRejection);

    try {
      const { socket } = await startSession();
      mocks.stallRuntimeEvaluationContaining('detached-cdp-message');

      const sender = mocks.handler.connectDevice.mock.calls[0]?.[2] as
        | { sendMessage: (message: unknown) => void }
        | undefined;
      expect(sender).toBeDefined();

      sender?.sendMessage({
        marker: 'detached-cdp-message',
      });
      await flushMicrotasks();

      socket.close();
      await flushMicrotasks();
      vi.useRealTimers();
      await new Promise((resolve) => {
        setImmediate(resolve);
      });

      expect(unhandledRejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', handleUnhandledRejection);
    }
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
