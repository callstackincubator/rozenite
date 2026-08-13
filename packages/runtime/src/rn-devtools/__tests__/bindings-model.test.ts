import { describe, expect, it, vi } from 'vitest';

// `rn-devtools-frontend.ts` re-exports modules from the Chrome DevTools frontend
// runtime (e.g. `/rozenite/core/sdk/sdk.js`), which only exist inside the actual
// DevTools frontend environment. For unit testing `bindingCalled` in isolation we
// stub it with a minimal `SDKModel` base class: `bindingCalled` never touches
// `target()` or the DevTools-provided `dispatchEventToListeners`, so a bare-bones
// stand-in is sufficient and avoids mocking 80% of an unrelated framework.
vi.mock('../rn-devtools-frontend.js', () => {
  class FakeSDKModel {
    private readonly fakeTarget: unknown;

    constructor(target: unknown) {
      this.fakeTarget = target;
    }

    target(): unknown {
      return this.fakeTarget;
    }

    dispatchEventToListeners(): void {
      // no-op: not exercised by bindingCalled
    }

    static register(): void {
      // no-op: registration is only meaningful inside the real DevTools frontend
    }
  }

  return {
    SDK: { SDKModel: { SDKModel: FakeSDKModel } },
  };
});

const { RozeniteBindingsModel } = await import('../bindings-model.js');

const BINDING_NAME = '__CHROME_DEVTOOLS_FRONTEND_BINDING__';

// `bindingCalled` and the fields it reads are private, so a real intersection with the
// class type collapses to `never`. This shape instead names just what the tests need,
// keeping access typed instead of poking at an untyped `any`.
type TestableModel = Pick<
  InstanceType<typeof RozeniteBindingsModel>,
  'subscribeToDomainMessages' | 'unsubscribeFromDomainMessages'
> & {
  messagingBindingName: string | null;
  fuseboxDispatcherIsInitialized: boolean;
  bindingCalled(event: { data: { name: string; payload: string } }): void;
};

describe('RozeniteBindingsModel bindingCalled', () => {
  const createModel = (): TestableModel => {
    const model = new RozeniteBindingsModel({} as never) as unknown as TestableModel;
    model.messagingBindingName = BINDING_NAME;
    model.fuseboxDispatcherIsInitialized = true;
    return model;
  };

  it('dispatches a rozenite message to listeners', () => {
    const model = createModel();
    const listener = vi.fn();
    model.subscribeToDomainMessages(listener);

    const payload = JSON.stringify({ domain: 'rozenite', message: { hello: 'world' } });
    model.bindingCalled({ data: { name: BINDING_NAME, payload } });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ hello: 'world' });
  });

  it('dispatches a rozenite message regardless of key order in the payload', () => {
    const model = createModel();
    const listener = vi.fn();
    model.subscribeToDomainMessages(listener);

    // The fast path must not assume `domain` comes before `message` (or anywhere in
    // particular) -- it only checks for the substring anywhere in the raw string.
    const payload = JSON.stringify({ message: { hello: 'world' }, domain: 'rozenite' });
    model.bindingCalled({ data: { name: BINDING_NAME, payload } });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ hello: 'world' });
  });

  it('skips a large non-rozenite payload without parsing it', () => {
    const parseSpy = vi.spyOn(JSON, 'parse');
    const model = createModel();
    const listener = vi.fn();
    model.subscribeToDomainMessages(listener);

    // Simulate a React DevTools bridge payload (e.g. a component subtree) that never
    // mentions our domain name. The size here is illustrative of real-world React
    // DevTools traffic; the assertion (JSON.parse not called) is size-independent.
    const componentTree = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      type: 'FunctionComponent',
      displayName: `Component${i}`,
    }));
    const payload = JSON.stringify({ domain: 'react-devtools', message: componentTree });

    model.bindingCalled({ data: { name: BINDING_NAME, payload } });

    expect(parseSpy).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();

    parseSpy.mockRestore();
  });

  it('still correctly rejects a non-rozenite payload that happens to contain the substring "rozenite"', () => {
    const model = createModel();
    const listener = vi.fn();
    model.subscribeToDomainMessages(listener);

    // The substring appears in the message body, not the domain field, so the cheap
    // pre-check cannot rule this out -- it must fall through to the real parse and
    // domain comparison, which correctly rejects it.
    const payload = JSON.stringify({
      domain: 'react-devtools',
      message: { note: 'unrelated mention of rozenite in the payload' },
    });

    expect(() => model.bindingCalled({ data: { name: BINDING_NAME, payload } })).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it('throws when a rozenite-looking payload is malformed JSON', () => {
    const model = createModel();

    const payload = '{"domain": "rozenite", "message": invalid}';

    expect(() => model.bindingCalled({ data: { name: BINDING_NAME, payload } })).toThrow(
      'Failed to parse bindingCalled event payload',
    );
  });
});
