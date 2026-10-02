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
    SDK: {
      SDKModel: { SDKModel: FakeSDKModel },
      // `sendMessage` names `SDK.RuntimeModel.RuntimeModel` when asking the
      // target for its runtime model; only the identity of that value matters.
      RuntimeModel: { RuntimeModel: class FakeRuntimeModel {} },
    },
  };
});

const { RozeniteBindingsModel } = await import('../bindings-model.js');

const BINDING_NAME = '__CHROME_DEVTOOLS_FRONTEND_BINDING__';

// `bindingCalled` and the fields it reads are private, so a real intersection with the
// class type collapses to `never`. This shape instead names just what the tests need,
// keeping access typed instead of poking at an untyped `any`.
type TestableModel = Pick<
  InstanceType<typeof RozeniteBindingsModel>,
  'subscribeToDomainMessages' | 'unsubscribeFromDomainMessages' | 'sendMessage'
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

const DISPATCHER_GLOBAL = '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__';

/**
 * Replays what the device does with the injected source text: compile it,
 * call the dispatcher, and `JSON.parse` the payload it is handed.
 */
const evaluateOnDevice = (expression: string): Array<[string, unknown]> => {
  const delivered: Array<[string, unknown]> = [];
  const dispatcher = {
    sendMessage: (domain: string, payload: string): void => {
      delivered.push([domain, JSON.parse(payload)]);
    },
  };

  new Function(DISPATCHER_GLOBAL, expression)(dispatcher);

  return delivered;
};

describe('RozeniteBindingsModel sendMessage', () => {
  const createSendingModel = (response: unknown, expressions: string[]): TestableModel => {
    const model = new RozeniteBindingsModel({
      model: () => ({
        agent: {
          invoke_evaluate: async (params: { expression: string }) => {
            expressions.push(params.expression);
            return response;
          },
        },
      }),
    } as never) as unknown as TestableModel;
    model.fuseboxDispatcherIsInitialized = true;
    return model;
  };

  it('keeps the injected expression ASCII-only so Hermes can compile it', async () => {
    const message = {
      pluginId: '@rozenite/storage-plugin',
      payload: { value: 'ship \u{1F389} it \u{2014} \u{65E5}\u{672C}\u{8A9E}' },
    };
    const expressions: string[] = [];

    await createSendingModel({ result: { type: 'string' } }, expressions).sendMessage(message);

    // The bug this guards: Hermes compiles the expression as UTF-8 source and
    // rejects a raw astral-plane code unit with `Invalid UTF-8 code point`,
    // losing the message. V8 accepts that raw form, so this ASCII-only
    // assertion is the part that actually reproduces the failure; the round
    // trip below proves the escaping the fix adds does not alter the payload.
    expect(expressions).toHaveLength(1);
    expect(expressions[0]).toMatch(/^[\x20-\x7E]+$/);
    expect(evaluateOnDevice(expressions[0])).toEqual([['rozenite', message]]);
  });

  it('reports a message the device refused to evaluate', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const expressions: string[] = [];

    // The DevTools frontend's generated `invoke_*` methods never reject, so
    // this is the only shape in which a lost message can surface at all.
    const model = createSendingModel(
      {
        exceptionDetails: {
          exceptionId: 1,
          text: 'Uncaught SyntaxError',
          lineNumber: 0,
          columnNumber: 0,
        },
        result: { type: 'object' },
      },
      expressions,
    );

    await expect(
      model.sendMessage({ pluginId: '@rozenite/storage-plugin' }),
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][0]).toContain('Uncaught SyntaxError');

    consoleError.mockRestore();
  });
});
