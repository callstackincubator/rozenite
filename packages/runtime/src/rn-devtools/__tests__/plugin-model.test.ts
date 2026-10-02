import { describe, expect, it, vi } from 'vitest';

vi.mock('../rn-devtools-frontend', () => {
  class FakeSDKModel {
    readonly fakeTarget: unknown;
    readonly dispatched: Array<[string, unknown]> = [];

    constructor(target: unknown) {
      this.fakeTarget = target;
    }

    dispatchEventToListeners(event: string, data?: unknown): void {
      this.dispatched.push([event, data]);
    }

    static register(): void {}
  }

  return { SDK: { SDKModel: { SDKModel: FakeSDKModel } } };
});

vi.mock('../bindings-model', () => ({ RozeniteBindingsModel: class {} }));

const { RozenitePluginModel } = await import('../plugin-model.js');

const createModel = () => {
  const calls: string[] = [];
  let enabled = false;
  const bindings = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    isEnabled: () => enabled,
    enable: vi.fn(async () => {
      calls.push('enable');
      enabled = true;
    }),
    subscribeToDomainMessages: vi.fn(() => {
      calls.push('subscribe');
    }),
  };
  const model = new RozenitePluginModel({ model: () => bindings } as never) as InstanceType<
    typeof RozenitePluginModel
  > & { dispatched: Array<[string, unknown]> };
  return { model, bindings, calls };
};

describe('RozenitePluginModel initialization', () => {
  it('subscribes to domain messages before enabling, and only once', async () => {
    const { model, bindings, calls } = createModel();

    model.ensureInitialized();
    model.ensureInitialized();
    await vi.waitFor(() => expect(model.isInitialized()).toBe(true));

    expect(calls).toEqual(['subscribe', 'enable']);
    expect(bindings.subscribeToDomainMessages).toHaveBeenCalledTimes(1);
    expect(model.dispatched.map(([e]) => e)).toEqual(['InitializationCompleted']);
  });

  it('does not subscribe again when the app reloads', async () => {
    const { model, bindings } = createModel();
    model.ensureInitialized();
    await vi.waitFor(() => expect(model.isInitialized()).toBe(true));

    const [, onCreated] = bindings.addEventListener.mock.calls.find(
      ([event]) => event === 'BackendExecutionContextCreated',
    )!;
    onCreated.call(model);

    expect(bindings.subscribeToDomainMessages).toHaveBeenCalledTimes(1);
    expect(bindings.enable).toHaveBeenCalledTimes(1);
    expect(model.dispatched.map(([e]) => e)).toEqual([
      'InitializationCompleted',
      'InitializationCompleted',
    ]);
  });
});
