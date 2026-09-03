// @vitest-environment jsdom
import type { MetroTarget } from '@rozenite/agent-shared';
import { IS_WEB_TARGET_EXPRESSION } from '@rozenite/tools/integration';
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
    if (expression === IS_WEB_TARGET_EXPRESSION) {
      return { result: { value: false } };
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
    // Real browsers dispatch `close` as a later *task*, after any
    // already-pending microtasks (e.g. a promise rejection scheduled by
    // the same code path that called `close()`) have drained. Firing it
    // synchronously here would invert that ordering and hide bugs that
    // only show up when `onclose` runs *after* such a microtask — see the
    // `rozeniteMissing` vs. `disconnected` ordering test below.
    setTimeout(() => {
      this.onclose?.({ reason });
    }, 0);
  }
}

const TARGET: ParsedTarget = {
  webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=1',
  deviceId: 'device-1',
  pageId: '1',
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

/** Builds a `MetroTarget` from just the fields a test cares about. */
const target = (overrides: {
  id: string;
  deviceId: string;
  webSocketDebuggerUrl: string;
  name?: string;
  pageId?: string;
}): MetroTarget => ({
  deviceId: overrides.deviceId,
  name: overrides.name ?? overrides.deviceId,
  appId: 'com.example.app',
  pageId: overrides.pageId ?? overrides.id,
  title: '',
  description: '',
  integration: 'react-native',
  id: overrides.id,
  webSocketDebuggerUrl: overrides.webSocketDebuggerUrl,
});

const mockAgentTargets = (targets: MetroTarget[]): void => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ ok: true, result: { targets } }),
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
        'Runtime.evaluate', // is-this-a-browser probe
        'Runtime.evaluate', // BINDING_NAME
        'Runtime.addBinding',
        'Runtime.evaluate', // initializeDomain("rozenite")
      ]);

      const expressions = getExpressions(socket);
      expect(expressions[0]).toContain(`globalThis.${RUNTIME_GLOBAL} != undefined`);
      expect(expressions[1]).toBe(IS_WEB_TARGET_EXPRESSION);
      expect(expressions[2]).toContain(`${RUNTIME_GLOBAL}.BINDING_NAME`);
      expect(expressions[3]).toContain('initializeDomain("rozenite")');
      expect(expressions.some((expression) => expression.includes('react-devtools'))).toBe(false);

      const addBinding = socket.sent.find((command) => command.method === 'Runtime.addBinding');
      expect(addBinding?.params).toEqual({ name: DEFAULT_BINDING_NAME });
    });

    it('reports the target as a browser when the device says so', async () => {
      const connection = createDeviceConnection(TARGET);
      const socket = FakeWebSocket.instances[0];
      socket.responder = (method, params) => {
        if (method === 'Runtime.evaluate' && params?.expression === IS_WEB_TARGET_EXPRESSION) {
          return { result: { value: true } };
        }
        return defaultResponder(method, params);
      };

      socket.open();
      await waitUntil(() => connection.getState().status === 'connected');

      expect(connection.getTargetIsWeb()).toBe(true);
    });

    it('reports the target as not a browser for a native device', async () => {
      const { connection } = await connectAndBootstrap();

      expect(connection.getTargetIsWeb()).toBe(false);
    });

    // The integration is advisory metadata. A device that cannot answer must
    // still get a working connection - and must report "unknown" rather than
    // a default that a caller cannot distinguish from a real answer.
    it('stays unknown, and still connects, when the probe throws on the device', async () => {
      const connection = createDeviceConnection(TARGET);
      const socket = FakeWebSocket.instances[0];
      socket.responder = (method, params) => {
        if (method === 'Runtime.evaluate' && params?.expression === IS_WEB_TARGET_EXPRESSION) {
          return { exceptionDetails: { text: 'ReferenceError: window is not defined' } };
        }
        return defaultResponder(method, params);
      };

      socket.open();
      await waitUntil(() => connection.getState().status === 'connected');

      expect(connection.getState()).toEqual({ status: 'connected' });
      expect(connection.getTargetIsWeb()).toBe(null);
    });

    it('stays unknown when the probe answers with something that is not a boolean', async () => {
      const connection = createDeviceConnection(TARGET);
      const socket = FakeWebSocket.instances[0];
      socket.responder = (method, params) => {
        if (method === 'Runtime.evaluate' && params?.expression === IS_WEB_TARGET_EXPRESSION) {
          return { result: { value: 'yes' } };
        }
        return defaultResponder(method, params);
      };

      socket.open();
      await waitUntil(() => connection.getState().status === 'connected');

      expect(connection.getTargetIsWeb()).toBe(null);
    });

    it('is unknown before the connection has bootstrapped', () => {
      const connection = createDeviceConnection(TARGET);

      expect(connection.getTargetIsWeb()).toBe(null);
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

    it('stays rozeniteMissing instead of being overwritten by the disconnected the bootstrap-failure close event causes', async () => {
      // The exhausted-poll path settles `rozeniteMissing` (a microtask, via
      // the promise rejection) and only *then* calls `socket.close()`
      // (whose `close` event is a later task) — a real close reason of ''
      // would otherwise be read as "unrecognized" and overwrite the state
      // the person is actually meant to see with `disconnected`.
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

      // Let the socket's own (now-async) close event actually arrive and
      // be processed — this is exactly the moment the bug would overwrite
      // the state.
      await vi.advanceTimersByTimeAsync(50);

      expect(connection.getState()).toEqual({ status: 'rozeniteMissing' });
    });

    it('fails fast on an evaluate exception instead of grinding through all dispatcher polls', async () => {
      const connection = createDeviceConnection(TARGET);
      const socket = FakeWebSocket.instances[0];
      socket.responder = (method, params) => {
        const expression = String(params?.expression ?? '');
        if (method === 'Runtime.evaluate' && expression.includes(`globalThis.${RUNTIME_GLOBAL}`)) {
          return { exceptionDetails: { text: 'ReferenceError: boom' } };
        }
        return defaultResponder(method, params);
      };

      socket.open();
      await vi.advanceTimersByTimeAsync(50);

      const dispatcherPolls = getExpressions(socket).filter((expression) =>
        expression.includes(`globalThis.${RUNTIME_GLOBAL} != undefined`),
      );
      expect(dispatcherPolls).toHaveLength(1); // failed on the first evaluate, not all 19
      expect(connection.getState().status).not.toBe('rozeniteMissing');
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
    it('ignores executionContextDestroyed for a context that was never registered as main', async () => {
      const { connection, socket } = await connectAndBootstrap();

      // No prior `executionContextCreated` ever told us this id was main
      // (e.g. a worker context tearing down) — must not wedge us into
      // `reloading` with nothing that will ever bring it back.
      socket.emitEvent('Runtime.executionContextDestroyed', { executionContextId: 999 });
      await vi.advanceTimersByTimeAsync(10);

      expect(connection.getState()).toEqual({ status: 'connected' });
    });

    it('goes to reloading only when the tracked main execution context is destroyed, then re-bootstraps on the same socket', async () => {
      const { connection, socket } = await connectAndBootstrap();

      // CDP announces the existing "main" context once Runtime is enabled;
      // this is what teaches the connection which id to watch for. The
      // connection is already `connected`, so wait out the debounce
      // explicitly rather than via `waitUntil` (which would otherwise see
      // "already connected" and return before the timer ever fires).
      socket.emitEvent('Runtime.executionContextCreated', { context: { id: 7, name: 'main' } });
      await vi.advanceTimersByTimeAsync(600);
      const sentBeforeReload = socket.sent.length;

      // A non-main context's destruction (e.g. a worker) must not react.
      socket.emitEvent('Runtime.executionContextDestroyed', { executionContextId: 123 });
      await vi.advanceTimersByTimeAsync(10);
      expect(connection.getState()).toEqual({ status: 'connected' });

      socket.emitEvent('Runtime.executionContextDestroyed', { executionContextId: 7 });
      expect(connection.getState()).toEqual({ status: 'reloading' });

      // Sends made mid-reload must queue, not fire against the torn-down
      // binding.
      connection.send({ hello: 'during-reload' });
      await vi.advanceTimersByTimeAsync(10);
      expect(socket.sent.length).toBe(sentBeforeReload);

      socket.emitEvent('Runtime.executionContextCreated', { context: { id: 8, name: 'main' } });
      await waitUntil(() => connection.getState().status === 'connected');

      expect(FakeWebSocket.instances).toHaveLength(1); // socket was never torn down

      const addBindingCalls = socket.sent.filter(
        (command) => command.method === 'Runtime.addBinding',
      );
      // Initial connect, the post-enable "main" announcement, and the
      // reload — three re-adds in all.
      expect(addBindingCalls).toHaveLength(3);

      const queuedSend = getExpressions(socket).some((expression) =>
        expression.includes(JSON.stringify(JSON.stringify({ hello: 'during-reload' }))),
      );
      expect(queuedSend).toBe(true);
    });

    it('ignores executionContextCreated events for non-main contexts', async () => {
      const { connection, socket } = await connectAndBootstrap();
      socket.emitEvent('Runtime.executionContextCreated', { context: { id: 7, name: 'main' } });
      await waitUntil(() => connection.getState().status === 'connected');

      socket.emitEvent('Runtime.executionContextDestroyed', { executionContextId: 7 });
      socket.emitEvent('Runtime.executionContextCreated', { context: { name: 'isolated' } });
      await vi.advanceTimersByTimeAsync(10);

      expect(connection.getState()).toEqual({ status: 'reloading' });
    });

    it('goes to reloading on Runtime.executionContextsCleared and re-bootstraps once a new main context appears', async () => {
      const { connection, socket } = await connectAndBootstrap();

      socket.emitEvent('Runtime.executionContextsCleared', {});
      expect(connection.getState()).toEqual({ status: 'reloading' });

      connection.send({ hello: 'during-clear' });
      await vi.advanceTimersByTimeAsync(10);

      socket.emitEvent('Runtime.executionContextCreated', { context: { id: 9, name: 'main' } });
      await waitUntil(() => connection.getState().status === 'connected');

      const queuedSend = getExpressions(socket).some((expression) =>
        expression.includes(JSON.stringify(JSON.stringify({ hello: 'during-clear' }))),
      );
      expect(queuedSend).toBe(true);
    });

    it('debounces a burst of executionContextCreated(main) events into a single re-bootstrap', async () => {
      const { connection, socket } = await connectAndBootstrap();

      socket.emitEvent('Runtime.executionContextCreated', { context: { id: 1, name: 'main' } });
      socket.emitEvent('Runtime.executionContextCreated', { context: { id: 1, name: 'main' } });
      socket.emitEvent('Runtime.executionContextCreated', { context: { id: 1, name: 'main' } });

      // Already `connected`, so wait out the debounce explicitly.
      await vi.advanceTimersByTimeAsync(600);
      expect(connection.getState()).toEqual({ status: 'connected' });

      const addBindingCalls = socket.sent.filter(
        (command) => command.method === 'Runtime.addBinding',
      );
      // One from the initial connect, plus exactly one more from the three
      // coalesced events — not one re-bootstrap per event.
      expect(addBindingCalls).toHaveLength(2);
    });
  });

  describe('close handling', () => {
    it('recovers from a recoverable close by re-resolving the target and reconnecting', async () => {
      const { connection, socket } = await connectAndBootstrap();

      mockAgentTargets([
        target({
          id: 'page-2',
          deviceId: 'device-1',
          name: 'iPhone 16',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=2',
        }),
      ]);

      socket.close('[CONNECTION_LOST]');
      await waitUntil(() => connection.getState().status === 'connecting');

      await waitUntil(() => FakeWebSocket.instances.length === 2);
      const newSocket = FakeWebSocket.instances[1];
      expect(newSocket.url).toBe('ws://localhost:8081/inspector/debug?device=device-1&page=2');

      newSocket.open();
      await waitUntil(() => connection.getState().status === 'connected');
      expect(connection.getTarget()).toEqual({
        name: 'iPhone 16',
        appId: 'com.example.app',
        framework: null,
      });
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
      mockAgentTargets([]); // never matches device-1 => resolveMetroTarget always rejects

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

  describe('initial connection retries', () => {
    it('retries a socket-level failure on the very first connection attempt instead of giving up after one', async () => {
      const connection = createDeviceConnection(TARGET);
      mockAgentTargets([
        target({
          id: 'page-1',
          deviceId: 'device-1',
          webSocketDebuggerUrl: TARGET.webSocketDebuggerUrl,
        }),
      ]);

      // The very first socket never even opens (e.g. Metro published the
      // target a moment before the debugger endpoint was actually ready)
      // and closes with a reason unrecognized as either terminal or
      // recoverable.
      FakeWebSocket.instances[0].close('');
      await waitUntil(() => FakeWebSocket.instances.length === 2, { stepMs: 500, maxSteps: 40 });

      expect(connection.getState()).toEqual({ status: 'connecting' }); // not disconnected after one try

      FakeWebSocket.instances[1].open();
      await waitUntil(() => connection.getState().status === 'connected');
    });

    it('still gives up after RECOVERY_MAX_ATTEMPTS if every initial-connection socket fails', async () => {
      const connection = createDeviceConnection(TARGET);
      mockAgentTargets([
        target({
          id: 'page-1',
          deviceId: 'device-1',
          webSocketDebuggerUrl: TARGET.webSocketDebuggerUrl,
        }),
      ]);

      const failEveryNewSocket = () => {
        for (const socket of FakeWebSocket.instances) {
          if (socket.readyState === FakeWebSocket.CONNECTING) {
            socket.close('');
          }
        }
      };
      failEveryNewSocket();

      await waitUntil(
        () => {
          failEveryNewSocket();
          return connection.getState().status === 'disconnected';
        },
        { stepMs: 500, maxSteps: 40 },
      );

      expect(FakeWebSocket.instances).toHaveLength(16);
    });
  });

  describe('reconnect and close', () => {
    it('reconnect() re-resolves the target and opens a fresh socket', async () => {
      const { connection, socket } = await connectAndBootstrap();
      socket.close('[NEW_DEBUGGER_OPENED]');
      await vi.advanceTimersByTimeAsync(10);
      expect(connection.getState()).toEqual({ status: 'disconnected' });

      mockAgentTargets([
        target({
          id: 'page-3',
          deviceId: 'device-1',
          name: 'iPhone 16',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=3',
        }),
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

    it('close() clears existing listeners so a later reconnect does not notify them', async () => {
      const { connection } = await connectAndBootstrap();
      const receivedBeforeClose: DeviceState[] = [];
      connection.subscribe((s) => receivedBeforeClose.push(s));

      connection.close();
      receivedBeforeClose.length = 0; // drop the 'disconnected' notification from close() itself

      mockAgentTargets([
        target({
          id: 'page-9',
          deviceId: 'device-1',
          name: 'iPhone 16',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=9',
        }),
      ]);
      connection.reconnect();
      await waitUntil(() => FakeWebSocket.instances.length === 2);
      FakeWebSocket.instances[1].open();
      await waitUntil(() => connection.getState().status === 'connected');

      expect(receivedBeforeClose).toEqual([]); // the pre-close subscriber was dropped
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

  describe('device name resolution', () => {
    it('best-effort resolves the friendly device name on the very first connection attempt', async () => {
      mockAgentTargets([
        target({
          id: 'page-1',
          deviceId: 'device-1',
          name: 'iPhone 15',
          webSocketDebuggerUrl: TARGET.webSocketDebuggerUrl,
        }),
      ]);
      const connection = createDeviceConnection(TARGET);
      expect(connection.getTarget().name).toBe('device-1'); // starts as the raw id

      const socket = FakeWebSocket.instances[0];
      socket.open();
      await waitUntil(() => connection.getState().status === 'connected');
      await waitUntil(() => connection.getTarget().name === 'iPhone 15');

      expect(FakeWebSocket.instances).toHaveLength(1); // never opened a second socket to get the name
    });

    it('does not block or delay connecting when the best-effort name lookup fails', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));
      const connection = createDeviceConnection(TARGET);
      const socket = FakeWebSocket.instances[0];
      socket.open();

      await waitUntil(() => connection.getState().status === 'connected');
      expect(connection.getTarget().name).toBe('device-1');
    });
  });

  describe('framework reporting', () => {
    it('reads the framework off ReactNativeApplication.metadataUpdated', async () => {
      const { connection, socket } = await connectAndBootstrap();
      expect(connection.getTarget().framework).toBeNull();

      socket.emitEvent('ReactNativeApplication.metadataUpdated', {
        integrationName: 'iOS Bridge (RCTBridge)',
        platform: 'ios',
        appDisplayName: 'MyApp',
      });

      expect(connection.getTarget().framework).toBe('React Native');
    });

    it('reads Lynx from the integration name the lynx-dev bridge answers with', async () => {
      const { connection, socket } = await connectAndBootstrap();

      socket.emitEvent('ReactNativeApplication.metadataUpdated', {
        integrationName: 'Lynx',
        platform: 'android',
        appDisplayName: 'LynxExplorer',
      });

      expect(connection.getTarget().framework).toBe('Lynx');
    });

    // The label and `getTargetIsWeb` are the same fact seen twice. This is
    // the guard that stops them drifting apart: a compatibility gate that
    // called the target native while the footer said "Web" would be worse
    // than either being late.
    it('agrees with the device probe when the reported platform disagrees', async () => {
      const connection = createDeviceConnection(TARGET);
      const socket = FakeWebSocket.instances[0];
      socket.responder = (method, params) => {
        if (method === 'Runtime.evaluate' && params?.expression === IS_WEB_TARGET_EXPRESSION) {
          return { result: { value: true } };
        }
        return defaultResponder(method, params);
      };

      socket.open();
      await waitUntil(() => connection.getState().status === 'connected');

      // The device says "browser"; the metadata event says the platform is
      // iOS. The probe wins, and the label matches what a gate would use.
      socket.emitEvent('ReactNativeApplication.metadataUpdated', {
        integrationName: 'Rozenite',
        platform: 'ios',
      });

      expect(connection.getTargetIsWeb()).toBe(true);
      expect(connection.getTarget().framework).toBe('Web');
    });

    it('falls back to the reported platform when the probe could not answer', async () => {
      const connection = createDeviceConnection(TARGET);
      const socket = FakeWebSocket.instances[0];
      socket.responder = (method, params) => {
        if (method === 'Runtime.evaluate' && params?.expression === IS_WEB_TARGET_EXPRESSION) {
          return { exceptionDetails: { text: 'boom' } };
        }
        return defaultResponder(method, params);
      };

      socket.open();
      await waitUntil(() => connection.getState().status === 'connected');

      socket.emitEvent('ReactNativeApplication.metadataUpdated', {
        integrationName: 'Rozenite',
        platform: 'web',
      });

      // Display still degrades gracefully - but the gate is told nothing
      // rather than being handed the same guess.
      expect(connection.getTarget().framework).toBe('Web');
      expect(connection.getTargetIsWeb()).toBe(null);
    });

    it('does not publish a label from the probe alone, so Lynx never flickers', async () => {
      const { connection, socket } = await connectAndBootstrap();

      // Bootstrap (and therefore the probe) has finished, and the probe
      // cannot see Lynx - so no label until the integration name lands.
      expect(connection.getTargetIsWeb()).toBe(false);
      expect(connection.getTarget().framework).toBeNull();

      socket.emitEvent('ReactNativeApplication.metadataUpdated', {
        integrationName: 'Lynx',
        platform: 'android',
      });

      expect(connection.getTarget().framework).toBe('Lynx');
    });

    it('notifies subscribers without a status change, like the device name does', async () => {
      const { connection, socket } = await connectAndBootstrap();
      const listener = vi.fn();
      connection.subscribe(listener);

      socket.emitEvent('ReactNativeApplication.metadataUpdated', { integrationName: 'Lynx' });

      expect(listener).toHaveBeenCalledWith({ status: 'connected' });
      expect(connection.getTarget().framework).toBe('Lynx');
    });

    it('keeps the last known framework across a reconnect', async () => {
      const { connection, socket } = await connectAndBootstrap();
      socket.emitEvent('ReactNativeApplication.metadataUpdated', { integrationName: 'Lynx' });

      socket.close('[CONNECTION_LOST]');
      await waitUntil(() => connection.getState().status !== 'connected');

      // The label describes the target, not the socket — it must not blink
      // away while the connection is being re-established.
      expect(connection.getTarget().framework).toBe('Lynx');
    });
  });

  describe('send queue bounds', () => {
    it('caps the queue and drops the oldest messages once it is full', async () => {
      const connection = createDeviceConnection(TARGET);
      const socket = FakeWebSocket.instances[0];

      for (let i = 0; i < 105; i++) {
        connection.send({ n: i });
      }

      socket.open();
      await waitUntil(() => connection.getState().status === 'connected');

      const sendMessageCalls = getExpressions(socket).filter((expression) =>
        expression.includes(`${RUNTIME_GLOBAL}.sendMessage("rozenite"`),
      );
      expect(sendMessageCalls).toHaveLength(100);
      expect(sendMessageCalls[0]).toContain(JSON.stringify(JSON.stringify({ n: 5 })));
      expect(sendMessageCalls[99]).toContain(JSON.stringify(JSON.stringify({ n: 104 })));
    });

    it('clears queued sends on a terminal disconnect instead of replaying them after reconnect', async () => {
      const { connection, socket } = await connectAndBootstrap();
      socket.close(''); // unrecognized reason -> disconnected (terminal)
      await waitUntil(() => connection.getState().status === 'disconnected');

      for (let i = 0; i < 5; i++) {
        connection.send({ n: i });
      }

      mockAgentTargets([
        target({
          id: 'page-2',
          deviceId: 'device-1',
          name: 'iPhone 16',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=2',
        }),
      ]);
      connection.reconnect();
      await waitUntil(() => FakeWebSocket.instances.length === 2);
      FakeWebSocket.instances[1].open();
      await waitUntil(() => connection.getState().status === 'connected');

      const sendMessageCalls = getExpressions(FakeWebSocket.instances[1]).filter((expression) =>
        expression.includes(`${RUNTIME_GLOBAL}.sendMessage("rozenite"`),
      );
      expect(sendMessageCalls).toHaveLength(0);
    });

    it('keeps queued sends across reloading (not a terminal state)', async () => {
      const { connection, socket } = await connectAndBootstrap();
      socket.emitEvent('Runtime.executionContextsCleared', {});
      expect(connection.getState()).toEqual({ status: 'reloading' });

      connection.send({ hello: 'during-reload' });
      socket.emitEvent('Runtime.executionContextCreated', { context: { id: 1, name: 'main' } });
      await waitUntil(() => connection.getState().status === 'connected');

      const queuedSend = getExpressions(socket).some((expression) =>
        expression.includes(JSON.stringify(JSON.stringify({ hello: 'during-reload' }))),
      );
      expect(queuedSend).toBe(true);
    });
  });

  describe('unhandled rejections (finding 5)', () => {
    it('does not produce an unhandled rejection when the socket closes with commands still in flight', async () => {
      const { connection, socket } = await connectAndBootstrap();
      socket.responder = () => SKIP; // leave every command pending

      const unhandled: unknown[] = [];
      const onUnhandledRejection = (reason: unknown) => unhandled.push(reason);
      process.on('unhandledRejection', onUnhandledRejection);

      try {
        connection.send({ hello: 'in-flight' }); // -> a detached `sendDomainMessage` call
        socket.close(''); // rejects it via `rejectAllPending()`

        // Let the close (a fake-timer task) and the rejection (a real
        // microtask) both actually settle, including Node's own check for
        // unhandled rejections, which runs after the real event loop
        // turns — not something fake timers alone advance.
        await vi.advanceTimersByTimeAsync(10);
        // Flush real microtasks/nextTicks (unaffected by fake timers) a
        // few times over — this is when Node's own unhandled-rejection
        // check actually runs.
        for (let i = 0; i < 5; i++) {
          await new Promise((resolve) => process.nextTick(resolve));
        }
      } finally {
        process.off('unhandledRejection', onUnhandledRejection);
      }

      expect(unhandled).toEqual([]);
    });
  });

  describe('pending command timeout', () => {
    it('times out a pending command instead of hanging forever when the device never responds', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('no metro'));
      const connection = createDeviceConnection(TARGET);
      const socket = FakeWebSocket.instances[0];
      socket.responder = () => SKIP; // the device never answers anything
      socket.open();

      // Command timeout (10s) + one retry backoff, well within this budget.
      await waitUntil(() => connection.getState().status === 'metroUnreachable', {
        stepMs: 1000,
        maxSteps: 60,
      });
    });
  });

  describe('recovery epoch scoping (finding A)', () => {
    it('a stale recovery attempt for a superseded epoch does not clear the in-flight flag for the current epoch', async () => {
      const { connection, socket } = await connectAndBootstrap();

      let resolveStaleFetch!: (value: unknown) => void;
      const staleFetch = new Promise((resolve) => {
        resolveStaleFetch = resolve;
      });

      let fetchCall = 0;
      globalThis.fetch = vi.fn(() => {
        fetchCall += 1;
        if (fetchCall === 1) {
          // Epoch 0's own recoverable-close recovery loop: hangs.
          return staleFetch;
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              ok: true,
              result: {
                targets: [
                  target({
                    id: `page-${fetchCall}`,
                    deviceId: 'device-1',
                    name: 'iPhone 16',
                    webSocketDebuggerUrl: `ws://localhost:8081/inspector/debug?device=device-1&page=${fetchCall}`,
                  }),
                ],
              },
            }),
        });
      }) as unknown as typeof fetch;

      // Epoch 0's recovery loop starts and hangs resolving the target.
      socket.close('[CONNECTION_LOST]');
      await waitUntil(() => connection.getState().status === 'connecting');

      // Supersede it: epoch bumps to 1 and starts its own loop, whose
      // target resolves immediately (the 2nd fetch call).
      connection.reconnect();
      await waitUntil(() => FakeWebSocket.instances.length === 2);
      const epoch1Socket = FakeWebSocket.instances[1];

      // Epoch 1 is now in flight (socket open, not yet bootstrapped). Let
      // epoch 0's long-stale fetch resolve now, while epoch 1 is still
      // mid-flight — this is the moment a non-epoch-scoped flag would be
      // wrongly cleared.
      resolveStaleFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true, result: { targets: [] } }),
      });
      await vi.advanceTimersByTimeAsync(0);

      // Epoch 1's socket now closes recoverably before it ever finished
      // connecting — exactly the case `runConnectLoop`'s own guard comment
      // describes ("this close fired for the socket that loop itself just
      // opened"). If epoch 0's stale `finally` wrongly cleared the
      // in-flight flag, this would start a second, duplicate loop for
      // epoch 1 racing the first one.
      epoch1Socket.close('[CONNECTION_LOST]');
      await waitUntil(() => FakeWebSocket.instances.length === 3, { stepMs: 500, maxSteps: 40 });

      // Give any wrongly-started duplicate attempt a chance to also open a
      // socket before asserting there isn't one.
      await vi.advanceTimersByTimeAsync(1000);

      expect(FakeWebSocket.instances).toHaveLength(3); // exactly one recovery re-opened, not two racing

      FakeWebSocket.instances[2].open();
      await waitUntil(() => connection.getState().status === 'connected');
    });
  });
});
