import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOOTSTRAP_DEBOUNCE_MS,
  MAIN_EXECUTION_CONTEXT_NAME,
  buildBindingNameExpression,
  buildDispatcherReadyExpression,
  buildInitializeDomainExpression,
} from '@rozenite/tools/protocol';
import { IS_WEB_TARGET_EXPRESSION } from '@rozenite/tools/integration';

// The DevTools frontend modules only exist inside the DevTools page, so the SDK
// is replaced with the smallest stand-in that records dispatched events.
vi.mock('../rn-devtools-frontend.js', () => {
  class FakeSDKModel {
    readonly fakeTarget: unknown;
    readonly dispatched: Array<[string, unknown]> = [];

    constructor(target: unknown) {
      this.fakeTarget = target;
    }

    target(): unknown {
      return this.fakeTarget;
    }

    dispatchEventToListeners(event: string, data?: unknown): void {
      this.dispatched.push([event, data]);
    }

    static register(): void {}
  }

  return {
    SDK: {
      SDKModel: { SDKModel: FakeSDKModel },
      RuntimeModel: { RuntimeModel: class FakeRuntimeModel {} },
    },
  };
});

const { RozeniteBindingsModel } = await import('../bindings-model.js');
const { SDK } = await import('../rn-devtools-frontend.js');

const BINDING = '__CHROME_DEVTOOLS_FRONTEND_BINDING__';

type Listener = (event: { data: unknown }) => void;

const createHarness = () => {
  const log: string[] = [];
  const listeners = new Map<string, Array<[Listener, unknown]>>();
  let dispatcherReady = true;

  const evaluate = vi.fn(async ({ expression }: { expression: string }) => {
    log.push(expression);
    if (expression === buildDispatcherReadyExpression()) {
      return { result: { type: 'boolean', value: dispatcherReady } };
    }
    if (expression === IS_WEB_TARGET_EXPRESSION) {
      return { result: { type: 'boolean', value: false } };
    }
    if (expression === buildBindingNameExpression()) {
      return { result: { type: 'string', value: BINDING } };
    }
    return { result: { type: 'undefined' } };
  });
  const addBinding = vi.fn(async ({ name }: { name: string }) => {
    log.push(`addBinding:${name}`);
    return { getError: (): string | undefined => undefined };
  });

  const runtimeModel = {
    agent: { invoke_evaluate: evaluate, invoke_addBinding: addBinding },
    addEventListener: (event: string, cb: Listener, thisArg: unknown) => {
      listeners.set(event, [...(listeners.get(event) ?? []), [cb, thisArg]]);
    },
    removeEventListener: (event: string, cb: Listener, thisArg: unknown) => {
      listeners.set(
        event,
        (listeners.get(event) ?? []).filter(([c, t]) => !(c === cb && t === thisArg)),
      );
    },
  };

  const target = {
    model: (kind: unknown) => (kind === SDK.RuntimeModel.RuntimeModel ? runtimeModel : null),
  };

  const model = new RozeniteBindingsModel(target as never) as InstanceType<
    typeof RozeniteBindingsModel
  > & { dispatched: Array<[string, unknown]> };

  const emit = (event: string, data: unknown) => {
    for (const [cb, thisArg] of [...(listeners.get(event) ?? [])]) {
      cb.call(thisArg, { data });
    }
  };

  return {
    model,
    log,
    evaluate,
    addBinding,
    emit,
    listenerCount: (event: string) => (listeners.get(event) ?? []).length,
    setDispatcherReady: (value: boolean) => {
      dispatcherReady = value;
    },
    domainInits: () =>
      log.filter((entry) => entry === buildInitializeDomainExpression('rozenite')).length,
  };
};

const reloadApp = (h: ReturnType<typeof createHarness>) => {
  h.emit('ExecutionContextDestroyed', { name: MAIN_EXECUTION_CONTEXT_NAME });
  h.emit('ExecutionContextCreated', { name: MAIN_EXECUTION_CONTEXT_NAME });
};

describe('RozeniteBindingsModel handshake', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the shared handshake in order, with the is-web probe after the dispatcher is ready', async () => {
    const h = createHarness();

    await h.model.enable();

    expect(h.log).toEqual([
      buildDispatcherReadyExpression(),
      IS_WEB_TARGET_EXPRESSION,
      buildBindingNameExpression(),
      `addBinding:${BINDING}`,
      buildInitializeDomainExpression('rozenite'),
    ]);
    expect(h.model.getTargetIsWeb()).toBe(false);
    expect(h.model.isEnabled()).toBe(true);
    expect(h.listenerCount('BindingCalled')).toBe(1);
  });

  it('asks for returnByValue only on the dispatcher-ready poll', async () => {
    const h = createHarness();

    await h.model.enable();

    const calls = h.evaluate.mock.calls.map(([params]) => params as Record<string, unknown>);
    expect(calls[0]).toEqual({
      expression: buildDispatcherReadyExpression(),
      returnByValue: true,
    });
    expect(calls.find((c) => c.expression === buildBindingNameExpression())).toEqual({
      expression: buildBindingNameExpression(),
    });
  });

  it('keeps the runtime wording for failures, naming this model', async () => {
    const h = createHarness();
    h.evaluate.mockImplementationOnce(async () => ({
      exceptionDetails: { text: 'boom' },
      result: { type: 'object' },
    }));
    await expect(h.model.enable()).rejects.toThrow(
      'Failed to wait for React DevTools dispatcher initialization: boom',
    );

    const h2 = createHarness();
    h2.addBinding.mockImplementationOnce(async () => ({
      getError: () => 'nope',
    }));
    await expect(h2.model.enable()).rejects.toThrow(
      'Failed to add binding for RozeniteBindingsModel: nope',
    );
  });

  it('re-runs the handshake once after a reload, after the debounce, then notifies', async () => {
    const h = createHarness();
    await h.model.enable();
    h.log.length = 0;

    reloadApp(h);

    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS - 1);
    expect(h.log).toEqual([]);
    expect(h.model.dispatched.map(([e]) => e)).toEqual(['BackendExecutionContextDestroyed']);

    await vi.advanceTimersByTimeAsync(1);
    // The probe is not repeated and the binding is added again on the fresh context.
    expect(h.log).toEqual([
      buildDispatcherReadyExpression(),
      buildBindingNameExpression(),
      `addBinding:${BINDING}`,
      buildInitializeDomainExpression('rozenite'),
    ]);
    expect(h.model.dispatched.map(([e]) => e)).toEqual([
      'BackendExecutionContextDestroyed',
      'BackendExecutionContextCreated',
    ]);
  });

  it('collapses a rapid double reload into one handshake', async () => {
    const h = createHarness();
    await h.model.enable();
    h.log.length = 0;

    reloadApp(h);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS / 2);
    reloadApp(h);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS * 4);

    expect(h.domainInits()).toBe(1);
    expect(h.model.dispatched.filter(([e]) => e === 'BackendExecutionContextCreated')).toHaveLength(
      1,
    );
  });

  it('abandons a handshake that a newer context has made stale', async () => {
    const h = createHarness();
    await h.model.enable();
    h.log.length = 0;
    h.setDispatcherReady(false);

    reloadApp(h);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS); // first run starts polling
    const pollsBefore = h.log.length;
    expect(pollsBefore).toBeGreaterThan(0);

    h.setDispatcherReady(true);
    reloadApp(h);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS * 4);

    expect(h.domainInits()).toBe(1);
    expect(h.model.dispatched.filter(([e]) => e === 'BackendExecutionContextCreated')).toHaveLength(
      1,
    );
    expect(h.model.dispatched.some(([e]) => e === 'BackendExecutionContextUnavailable')).toBe(
      false,
    );
  });

  it('stops evaluating once disposed mid-handshake', async () => {
    const h = createHarness();
    await h.model.enable();
    h.log.length = 0;
    h.setDispatcherReady(false);

    reloadApp(h);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS);
    h.model.dispose();
    const evaluatesAtDispose = h.evaluate.mock.calls.length;

    h.setDispatcherReady(true);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS * 20);

    expect(h.evaluate.mock.calls.length).toBe(evaluatesAtDispose);
    expect(h.domainInits()).toBe(0);
    expect(h.model.dispatched.map(([e]) => e)).not.toContain('BackendExecutionContextCreated');
  });

  it('does not start a handshake for a reload that is pending when disposed', async () => {
    const h = createHarness();
    await h.model.enable();
    h.log.length = 0;

    reloadApp(h);
    h.model.dispose();
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS * 4);

    expect(h.log).toEqual([]);
  });

  it('reports a failed re-handshake as unavailable', async () => {
    const h = createHarness();
    await h.model.enable();

    h.evaluate.mockImplementationOnce(async () => ({
      exceptionDetails: { text: 'gone' },
      result: { type: 'object' },
    }));
    reloadApp(h);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS);

    expect(h.model.dispatched.at(-1)).toEqual([
      'BackendExecutionContextUnavailable',
      'Failed to wait for React DevTools dispatcher initialization: gone',
    ]);
  });

  it('does not notify when the model is disposed while the final domain init is pending', async () => {
    const h = createHarness();
    await h.model.enable();
    h.log.length = 0;
    let release: () => void = () => {};
    h.evaluate.mockImplementation(async ({ expression }: { expression: string }) => {
      h.log.push(expression);
      if (expression === buildInitializeDomainExpression('rozenite')) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      if (expression === buildBindingNameExpression()) {
        return { result: { type: 'string', value: BINDING } };
      }
      return { result: { type: 'boolean', value: true } };
    });

    reloadApp(h);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS);
    expect(h.domainInits()).toBe(1);

    h.model.dispose();
    release();
    await vi.advanceTimersByTimeAsync(0);

    expect(h.model.dispatched.map(([e]) => e)).not.toContain('BackendExecutionContextCreated');
  });

  it('leaves the notification to the newer run when a reload lands during the final domain init', async () => {
    const h = createHarness();
    await h.model.enable();
    const releases: Array<() => void> = [];
    h.evaluate.mockImplementation(async ({ expression }: { expression: string }) => {
      h.log.push(expression);
      if (expression === buildInitializeDomainExpression('rozenite')) {
        await new Promise<void>((resolve) => releases.push(resolve));
      }
      if (expression === buildBindingNameExpression()) {
        return { result: { type: 'string', value: BINDING } };
      }
      return { result: { type: 'boolean', value: true } };
    });

    reloadApp(h);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS);
    reloadApp(h); // the first run's domain init is still pending
    releases[0]();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.model.dispatched.map(([e]) => e)).not.toContain('BackendExecutionContextCreated');

    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS);
    releases[1]();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.model.dispatched.filter(([e]) => e === 'BackendExecutionContextCreated')).toHaveLength(
      1,
    );
  });

  it('turns a dispose that lands as enable() finishes into the disposed error', async () => {
    const h = createHarness();
    let release: () => void = () => {};
    h.evaluate.mockImplementation(async ({ expression }: { expression: string }) => {
      if (expression === buildInitializeDomainExpression('rozenite')) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      if (expression === buildBindingNameExpression()) {
        return { result: { type: 'string', value: BINDING } };
      }
      return { result: { type: 'boolean', value: true } };
    });

    const enabling = h.model.enable();
    const outcome = expect(enabling).rejects.toThrow('disposed while it was being enabled');
    await vi.advanceTimersByTimeAsync(0);
    h.model.dispose();
    release();
    await outcome;
    expect(h.model.isEnabled()).toBe(false);
  });

  it('turns a dispose during enable() into the disposed error', async () => {
    const h = createHarness();
    h.setDispatcherReady(false);

    const outcome = expect(h.model.enable()).rejects.toThrow('disposed while it was being enabled');
    await vi.advanceTimersByTimeAsync(10);
    h.model.dispose();
    h.setDispatcherReady(true);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS * 4);

    await outcome;
    expect(h.domainInits()).toBe(0);
  });

  it('describes a reload that never finishes as a slow reload, not a missing install', async () => {
    const h = createHarness();
    await h.model.enable();
    h.setDispatcherReady(false);

    reloadApp(h);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS + 60_000);

    const last = h.model.dispatched.at(-1);
    expect(last?.[0]).toBe('BackendExecutionContextUnavailable');
    expect(last?.[1]).toBe(
      'The app did not finish reloading in time. Reload the app or reopen React Native DevTools.',
    );
  });

  it('recovers: a failed re-handshake is followed by a successful one on the next reload', async () => {
    const h = createHarness();
    await h.model.enable();

    h.evaluate.mockImplementationOnce(async () => ({
      exceptionDetails: { text: 'gone' },
      result: { type: 'object' },
    }));
    reloadApp(h);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS);
    expect(h.model.dispatched.at(-1)?.[0]).toBe('BackendExecutionContextUnavailable');

    reloadApp(h);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS);
    expect(h.model.dispatched.at(-1)?.[0]).toBe('BackendExecutionContextCreated');
  });

  it('drops a handshake still running when its context is destroyed', async () => {
    const h = createHarness();
    await h.model.enable();
    h.log.length = 0;
    h.setDispatcherReady(false);

    reloadApp(h);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS);
    h.emit('ExecutionContextDestroyed', { name: MAIN_EXECUTION_CONTEXT_NAME });
    h.setDispatcherReady(true);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS * 10);

    expect(h.domainInits()).toBe(0);
    expect(h.model.dispatched.map(([e]) => e)).not.toContain('BackendExecutionContextCreated');
  });

  it('always calls addBinding on a re-handshake', async () => {
    const h = createHarness();
    await h.model.enable();

    reloadApp(h);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS);

    expect(h.addBinding).toHaveBeenCalledTimes(2);
  });

  it('ignores contexts that are not the main one', async () => {
    const h = createHarness();
    await h.model.enable();
    h.log.length = 0;

    h.emit('ExecutionContextCreated', { name: 'other' });
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS * 2);

    expect(h.log).toEqual([]);
  });

  it('does not duplicate listeners across reloads, and delivers each message once', async () => {
    const h = createHarness();
    await h.model.enable();
    const received = vi.fn();
    h.model.subscribeToDomainMessages(received);

    reloadApp(h);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS);
    reloadApp(h);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS);

    expect(h.listenerCount('BindingCalled')).toBe(1);
    expect(h.listenerCount('ExecutionContextCreated')).toBe(1);
    expect(h.listenerCount('ExecutionContextDestroyed')).toBe(1);

    h.emit('BindingCalled', {
      name: BINDING,
      payload: JSON.stringify({ domain: 'rozenite', message: { n: 1 } }),
    });
    expect(received).toHaveBeenCalledTimes(1);
    expect(received).toHaveBeenCalledWith({ n: 1 });
  });

  it('queues messages that arrive between the reload and the handshake, then flushes them once', async () => {
    const h = createHarness();
    await h.model.enable();
    const received = vi.fn();
    h.model.subscribeToDomainMessages(received);

    reloadApp(h);
    h.emit('BindingCalled', {
      name: BINDING,
      payload: JSON.stringify({ domain: 'rozenite', message: 'early' }),
    });
    expect(received).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS);

    expect(received).toHaveBeenCalledTimes(1);
    expect(received).toHaveBeenCalledWith('early');
  });
});
