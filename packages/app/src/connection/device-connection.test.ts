// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeviceConnection, type DeviceState } from './device-connection';
import type { ParsedTarget } from './target-from-url';

const RUNTIME_GLOBAL = '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__';
const DEFAULT_BINDING_NAME = 'rozenite-test-binding';

const SKIP = Symbol('skip-response');

type SentCommand = { id: number; method: string; params?: Record<string, unknown> };
type Responder = (method: string, params: Record<string, unknown> | undefined) => unknown;

const defaultResponder: Responder = (method, params) => {
  if (method === 'Runtime.evaluate') {
    const expression = String(params?.expression ?? '');
    if (expression.includes(`globalThis.${RUNTIME_GLOBAL} != undefined`)) {
      return { result: { value: true } };
    }
    if (expression.includes(`${RUNTIME_GLOBAL}.BINDING_NAME`)) {
      return { result: { value: DEFAULT_BINDING_NAME } };
    }
  }
  return {};
};

// A minimal, fully-controllable stand-in for the browser's WebSocket. Every
// `send` is auto-answered by `responder` (a fresh `queueMicrotask` per
// command, mirroring real async round-trips) unless it returns `SKIP`, and
// `emitEvent` lets a test push a raw CDP event (bindingCalled,
// executionContext*) at the connection.
class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: SentCommand[] = [];
  responder: Responder = defaultResponder;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(raw: string): void {
    const payload = JSON.parse(raw) as SentCommand;
    this.sent.push(payload);
    const result = this.responder(payload.method, payload.params);
    if (result === SKIP) {
      return;
    }
    queueMicrotask(() => {
      this.onmessage?.({ data: JSON.stringify({ id: payload.id, result }) });
    });
  }

  emitEvent(method: string, params: Record<string, unknown> = {}): void {
    this.onmessage?.({ data: JSON.stringify({ method, params }) });
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  close(reason = ''): void {
    if (this.readyState === FakeWebSocket.CLOSED) {
      return;
    }
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ reason });
  }
}

const TARGET: ParsedTarget = {
  webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=1',
  deviceId: 'device-1',
  appId: 'com.example.app',
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.useFakeTimers();
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  globalThis.fetch = originalFetch;
});

/** Repeatedly advances fake time (which also drains any pending
 * microtasks) until `predicate` is true, or fails. Polling instead of
 * counting exact ticks keeps these tests honest about *behavior*
 * (eventually reaches state X) rather than an implementation's exact
 * microtask depth. */
const waitUntil = async (
  predicate: () => boolean,
  { stepMs = 50, maxSteps = 200 }: { stepMs?: number; maxSteps?: number } = {},
): Promise<void> => {
  for (let i = 0; i < maxSteps; i++) {
    if (predicate()) {
      return;
    }
    await vi.advanceTimersByTimeAsync(stepMs);
  }
  if (!predicate()) {
    throw new Error('waitUntil: condition was not met in time');
  }
};

const getExpressions = (socket: FakeWebSocket): string[] =>
  socket.sent
    .filter((command) => command.method === 'Runtime.evaluate')
    .map((command) => String(command.params?.expression ?? ''));

const mockMetroList = (pages: unknown[]): void => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(pages),
  }) as unknown as typeof fetch;
};

const connectAndBootstrap = async (target: ParsedTarget = TARGET) => {
  const connection = createDeviceConnection(target);
  const socket = FakeWebSocket.instances[0];
  socket.open();
  await waitUntil(() => connection.getState().status === 'connected');
  return { connection, socket };
};

describe('createDeviceConnection', () => {
  describe('bootstrap', () => {
    it('reports connecting synchronously, then connected once bootstrap finishes', async () => {
      const connection = createDeviceConnection(TARGET);
      expect(connection.getState()).toEqual({ status: 'connecting' });

      const socket = FakeWebSocket.instances[0];
      socket.open();
      await waitUntil(() => connection.getState().status === 'connected');

      expect(connection.getState()).toEqual({ status: 'connected' });
    });

    it('runs the enable + bootstrap commands in order, and never initializes react-devtools', async () => {
      const { socket } = await connectAndBootstrap();

      expect(socket.sent.map((command) => command.method)).toEqual([
        'ReactNativeApplication.enable',
        'Runtime.enable',
        'Runtime.evaluate', // dispatcher poll
        'Runtime.evaluate', // BINDING_NAME
        'Runtime.addBinding',
        'Runtime.evaluate', // initializeDomain("rozenite")
      ]);

      const expressions = getExpressions(socket);
      expect(expressions[0]).toContain(`globalThis.${RUNTIME_GLOBAL} != undefined`);
      expect(expressions[1]).toContain(`${RUNTIME_GLOBAL}.BINDING_NAME`);
      expect(expressions[2]).toContain('initializeDomain("rozenite")');
      expect(expressions.some((expression) => expression.includes('react-devtools'))).toBe(false);

      const addBinding = socket.sent.find((command) => command.method === 'Runtime.addBinding');
      expect(addBinding?.params).toEqual({ name: DEFAULT_BINDING_NAME });
    });

    it('becomes rozeniteMissing once the dispatcher poll is exhausted', async () => {
      const connection = createDeviceConnection(TARGET);
      const socket = FakeWebSocket.instances[0];
      socket.responder = (method, params) => {
        const expression = String(params?.expression ?? '');
        if (method === 'Runtime.evaluate' && expression.includes(`globalThis.${RUNTIME_GLOBAL}`)) {
          return { result: { value: false } };
        }
        return defaultResponder(method, params);
      };

      socket.open();
      await waitUntil(() => connection.getState().status === 'rozeniteMissing', {
        stepMs: 250,
        maxSteps: 40,
      });

      const dispatcherPolls = getExpressions(socket).filter((expression) =>
        expression.includes(`globalThis.${RUNTIME_GLOBAL} != undefined`),
      );
      // 20 is the constant, but only the first 19 "attempts" actually poll —
      // see the comment on waitForDispatcher in device-connection.ts.
      expect(dispatcherPolls).toHaveLength(19);
      expect(socket.sent.some((command) => command.method === 'Runtime.addBinding')).toBe(false);
    });
  });

  describe('send queueing', () => {
    it('queues sends made before bootstrap completes and flushes them in order once connected', async () => {
      const connection = createDeviceConnection(TARGET);
      const socket = FakeWebSocket.instances[0];

      connection.send({ hello: 1 });
      connection.send({ hello: 2 });

      socket.open();
      await waitUntil(() => connection.getState().status === 'connected');

      const sendMessageCalls = getExpressions(socket).filter((expression) =>
        expression.includes(`${RUNTIME_GLOBAL}.sendMessage("rozenite"`),
      );
      expect(sendMessageCalls).toHaveLength(2);
      expect(sendMessageCalls[0]).toContain(JSON.stringify(JSON.stringify({ hello: 1 })));
      expect(sendMessageCalls[1]).toContain(JSON.stringify(JSON.stringify({ hello: 2 })));

      // The queue is flushed only after initializeDomain("rozenite").
      const initializeIndex = getExpressions(socket).findIndex((expression) =>
        expression.includes('initializeDomain("rozenite")'),
      );
      const firstSendIndex = getExpressions(socket).findIndex((expression) =>
        expression.includes('sendMessage("rozenite"'),
      );
      expect(firstSendIndex).toBeGreaterThan(initializeIndex);
    });

    it('sends immediately once connected', async () => {
      const { connection, socket } = await connectAndBootstrap();
      const before = socket.sent.length;

      connection.send({ hello: 3 });
      await waitUntil(() => socket.sent.length > before);

      expect(
        getExpressions(socket).some((expression) =>
          expression.includes(JSON.stringify(JSON.stringify({ hello: 3 }))),
        ),
      ).toBe(true);
    });
  });

  describe('message routing', () => {
    it('forwards rozenite-domain binding payloads and drops other domains', async () => {
      const { connection, socket } = await connectAndBootstrap();
      const received: unknown[] = [];
      connection.onMessage((message) => received.push(message));

      socket.emitEvent('Runtime.bindingCalled', {
        payload: JSON.stringify({ domain: 'rozenite', message: { type: 'ping' } }),
      });
      socket.emitEvent('Runtime.bindingCalled', {
        payload: JSON.stringify({ domain: 'react-devtools', message: { type: 'ignored' } }),
      });
      await waitUntil(() => received.length > 0);

      expect(received).toEqual([{ type: 'ping' }]);
    });

    it('unsubscribes onMessage listeners', async () => {
      const { connection, socket } = await connectAndBootstrap();
      const received: unknown[] = [];
      const unsubscribe = connection.onMessage((message) => received.push(message));
      unsubscribe();

      socket.emitEvent('Runtime.bindingCalled', {
        payload: JSON.stringify({ domain: 'rozenite', message: { type: 'ping' } }),
      });
      await vi.advanceTimersByTimeAsync(10);

      expect(received).toEqual([]);
    });
  });

  describe('execution context churn (reload survival)', () => {
    it('goes to reloading on context destruction, then re-bootstraps on the same socket', async () => {
      const { connection, socket } = await connectAndBootstrap();
      const sentBeforeReload = socket.sent.length;

      socket.emitEvent('Runtime.executionContextDestroyed', {});
      expect(connection.getState()).toEqual({ status: 'reloading' });

      // Sends made mid-reload must queue, not fire against the torn-down
      // binding.
      connection.send({ hello: 'during-reload' });
      await vi.advanceTimersByTimeAsync(10);
      expect(socket.sent.length).toBe(sentBeforeReload);

      socket.emitEvent('Runtime.executionContextCreated', { context: { name: 'main' } });
      await waitUntil(() => connection.getState().status === 'connected');

      expect(FakeWebSocket.instances).toHaveLength(1); // socket was never torn down

      const addBindingCalls = socket.sent.filter(
        (command) => command.method === 'Runtime.addBinding',
      );
      expect(addBindingCalls).toHaveLength(2); // re-added after the reload

      const queuedSend = getExpressions(socket).some((expression) =>
        expression.includes(JSON.stringify(JSON.stringify({ hello: 'during-reload' }))),
      );
      expect(queuedSend).toBe(true);
    });

    it('ignores executionContextCreated events for non-main contexts', async () => {
      const { connection, socket } = await connectAndBootstrap();
      socket.emitEvent('Runtime.executionContextDestroyed', {});
      socket.emitEvent('Runtime.executionContextCreated', { context: { name: 'isolated' } });
      await vi.advanceTimersByTimeAsync(10);

      expect(connection.getState()).toEqual({ status: 'reloading' });
    });
  });

  describe('close handling', () => {
    it('recovers from a recoverable close by re-resolving the target and reconnecting', async () => {
      const { connection, socket } = await connectAndBootstrap();

      mockMetroList([
        {
          id: 'page-2',
          deviceName: 'iPhone 16',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=2',
          reactNative: { logicalDeviceId: 'device-1' },
        },
      ]);

      socket.close('[CONNECTION_LOST]');
      expect(connection.getState()).toEqual({ status: 'connecting' });

      await waitUntil(() => FakeWebSocket.instances.length === 2);
      const newSocket = FakeWebSocket.instances[1];
      expect(newSocket.url).toBe('ws://localhost:8081/inspector/debug?device=device-1&page=2');

      newSocket.open();
      await waitUntil(() => connection.getState().status === 'connected');
      expect(connection.getTarget()).toEqual({ name: 'iPhone 16', appId: 'com.example.app' });
    });

    it('goes straight to disconnected when another debugger took the device', async () => {
      const { connection, socket } = await connectAndBootstrap();

      socket.close('[NEW_DEBUGGER_OPENED]');
      await vi.advanceTimersByTimeAsync(10);

      expect(connection.getState()).toEqual({ status: 'disconnected' });
      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('goes straight to disconnected on an unrecognized close reason', async () => {
      const { connection, socket } = await connectAndBootstrap();

      socket.close('');
      await vi.advanceTimersByTimeAsync(10);

      expect(connection.getState()).toEqual({ status: 'disconnected' });
      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('gives up after 16 recovery attempts and becomes disconnected', async () => {
      const { connection, socket } = await connectAndBootstrap();
      mockMetroList([]); // never matches device-1 => resolveMetroTarget always rejects

      socket.close('[PAGE_NOT_FOUND]');
      await waitUntil(() => connection.getState().status === 'disconnected', {
        stepMs: 500,
        maxSteps: 40,
      });

      expect(FakeWebSocket.instances).toHaveLength(1); // never got far enough to reconnect
      expect(globalThis.fetch).toHaveBeenCalledTimes(16);
    });

    it('becomes metroUnreachable when /json/list cannot be reached, without exhausting retries', async () => {
      const { connection, socket } = await connectAndBootstrap();
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));

      socket.close('[RECREATING_DEVICE]');
      await waitUntil(() => connection.getState().status === 'metroUnreachable');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(FakeWebSocket.instances).toHaveLength(1);
    });
  });

  describe('reconnect and close', () => {
    it('reconnect() re-resolves the target and opens a fresh socket', async () => {
      const { connection, socket } = await connectAndBootstrap();
      socket.close('[NEW_DEBUGGER_OPENED]');
      await vi.advanceTimersByTimeAsync(10);
      expect(connection.getState()).toEqual({ status: 'disconnected' });

      mockMetroList([
        {
          id: 'page-3',
          deviceName: 'iPhone 16',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=3',
          reactNative: { logicalDeviceId: 'device-1' },
        },
      ]);

      connection.reconnect();
      expect(connection.getState()).toEqual({ status: 'connecting' });

      await waitUntil(() => FakeWebSocket.instances.length === 2);
      FakeWebSocket.instances[1].open();
      await waitUntil(() => connection.getState().status === 'connected');
    });

    it('close() tears the socket down, moves to disconnected, and does not recover', async () => {
      const { connection, socket } = await connectAndBootstrap();

      connection.close();

      expect(connection.getState()).toEqual({ status: 'disconnected' });
      expect(socket.readyState).toBe(FakeWebSocket.CLOSED);

      await vi.advanceTimersByTimeAsync(1000);
      expect(FakeWebSocket.instances).toHaveLength(1);
      expect(connection.getState()).toEqual({ status: 'disconnected' });
    });
  });

  describe('subscribe', () => {
    it('notifies subscribers of state changes and stops after unsubscribing', async () => {
      const connection = createDeviceConnection(TARGET);
      const states: DeviceState[] = [];
      const unsubscribe = connection.subscribe((state) => states.push(state));

      const socket = FakeWebSocket.instances[0];
      socket.open();
      await waitUntil(() => connection.getState().status === 'connected');

      expect(states).toEqual([{ status: 'connected' }]);

      unsubscribe();
      socket.close('[NEW_DEBUGGER_OPENED]');
      await vi.advanceTimersByTimeAsync(10);

      expect(states).toEqual([{ status: 'connected' }]);
    });
  });
});
