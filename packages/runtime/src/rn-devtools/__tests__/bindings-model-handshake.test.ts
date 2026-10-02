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

  it('only polls and notifies for a new main context; it does not repeat the handshake', async () => {
    const h = createHarness();
    await h.model.enable();
    h.log.length = 0;

    reloadApp(h);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS * 4);

    expect(h.log).toEqual([buildDispatcherReadyExpression()]);
    expect(h.model.dispatched.map(([e]) => e)).toEqual([
      'BackendExecutionContextDestroyed',
      'BackendExecutionContextCreated',
    ]);
  });

  it('ignores contexts that are not the main one', async () => {
    const h = createHarness();
    await h.model.enable();
    h.log.length = 0;

    h.emit('ExecutionContextCreated', { name: 'other' });
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS * 2);

    expect(h.log).toEqual([]);
  });

  it('turns a dispose during the handshake into the disposed error', async () => {
    const h = createHarness();
    h.setDispatcherReady(false);

    const enabling = h.model.enable();
    const outcome = expect(enabling).rejects.toThrow('disposed while it was being enabled');
    await vi.advanceTimersByTimeAsync(10);
    h.model.dispose();
    h.setDispatcherReady(true);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_DEBOUNCE_MS * 4);

    await outcome;
    expect(h.model.isEnabled()).toBe(false);
    expect(h.domainInits()).toBe(0);
  });

  it('adds the binding and its listener once, and queues messages until enable resolves', async () => {
    const h = createHarness();
    const received = vi.fn();
    h.model.subscribeToDomainMessages(received);

    // The device can speak as soon as the binding exists, before the domain
    // initialization has even been sent.
    h.addBinding.mockImplementationOnce(async () => {
      h.emit('BindingCalled', {
        name: BINDING,
        payload: JSON.stringify({ domain: 'rozenite', message: 'early' }),
      });
      return { getError: (): string | undefined => undefined };
    });
    await h.model.enable();

    expect(h.listenerCount('BindingCalled')).toBe(1);
    expect(h.addBinding).toHaveBeenCalledTimes(1);
    expect(received).toHaveBeenCalledTimes(1);
    expect(received).toHaveBeenCalledWith('early');
  });
});
