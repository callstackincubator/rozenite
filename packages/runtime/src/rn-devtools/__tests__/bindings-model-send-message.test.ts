import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `rn-devtools-frontend.ts` re-exports modules from the Chrome DevTools frontend
// runtime (e.g. `/rozenite/core/sdk/sdk.js`), which only exist inside the actual
// DevTools frontend environment. This mirrors the stub used for the
// `bindingCalled` unit tests in the neighboring `bindings-model.test.ts` file: a
// minimal `SDKModel` base class plus a `RuntimeModel` token used only for
// identity comparison in `target().model(SDK.RuntimeModel.RuntimeModel)`.
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
      // no-op: not exercised by these tests
    }

    static register(): void {
      // no-op: registration is only meaningful inside the real DevTools frontend
    }
  }

  class RuntimeModelToken {}

  return {
    SDK: {
      SDKModel: { SDKModel: FakeSDKModel },
      RuntimeModel: { RuntimeModel: RuntimeModelToken },
    },
  };
});

const { SDK } = await import('../rn-devtools-frontend.js');
const { RozeniteBindingsModel, sanitizeUnpairedSurrogates } = await import('../bindings-model.js');

// The real `RuntimeAgent`'s generated `invoke_*` methods never reject -- a
// protocol-level failure resolves with `getError()` set instead (verified
// directly against the vendored `@react-native/debugger-frontend` bundle's
// `protocol_client.js`). `getError: () => undefined` is the "no error" case a
// real successful response always carries, so every fake response below
// includes it -- a response missing it would not be representative of the
// real agent.
const okResponse = (extra: Record<string, unknown> = {}) => ({
  getError: () => undefined,
  ...extra,
});

type FakeAgent = {
  invoke_evaluate: ReturnType<typeof vi.fn>;
  invoke_addBinding: ReturnType<typeof vi.fn>;
  invoke_callFunctionOn: ReturnType<typeof vi.fn>;
};

type FakeRuntimeModel = {
  agent: FakeAgent;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  executionContexts: ReturnType<typeof vi.fn>;
};

// `sendMessage`, `mainExecutionContextId`, and the execution-context listener
// methods are private; this shape names just what the tests need instead of
// poking at an untyped `any`, matching the pattern used by the neighboring
// `bindingCalled` test file.
type TestableModel = Pick<InstanceType<typeof RozeniteBindingsModel>, 'sendMessage'> & {
  fuseboxDispatcherIsInitialized: boolean;
  mainExecutionContextId: number | null;
  initializeExecutionContextListeners(): void;
  onExecutionContextCreated(event: { data: { name: string; id: number } }): void;
  onExecutionContextDestroyed(event: { data: { name: string; id: number } }): void;
};

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('RozeniteBindingsModel sendMessage', () => {
  let runtimeModel: FakeRuntimeModel;
  let existingContexts: Array<{ id: number; name: string }>;

  beforeEach(() => {
    existingContexts = [];
    runtimeModel = {
      agent: {
        invoke_evaluate: vi.fn(async () => okResponse({ result: { value: true } })),
        invoke_addBinding: vi.fn(async () => okResponse()),
        invoke_callFunctionOn: vi.fn(async () => okResponse({ result: {} })),
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      executionContexts: vi.fn(() => existingContexts),
    };
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createModel = (): TestableModel => {
    const fakeTarget = {
      model: (token: unknown) => (token === SDK.RuntimeModel.RuntimeModel ? runtimeModel : null),
    };
    const model = new RozeniteBindingsModel(fakeTarget as never) as unknown as TestableModel;
    model.fuseboxDispatcherIsInitialized = true;
    return model;
  };

  it('does nothing (and does not throw) when the dispatcher is not initialized', async () => {
    const model = createModel();
    model.fuseboxDispatcherIsInitialized = false;
    model.mainExecutionContextId = 5;

    await model.sendMessage({ hello: 'world' });

    expect(runtimeModel.agent.invoke_callFunctionOn).not.toHaveBeenCalled();
  });

  it('falls back to Runtime.evaluate when no main execution context is known yet, instead of dropping the message', async () => {
    const model = createModel();
    model.mainExecutionContextId = null;

    const message = { pluginId: 'p', type: 'ping' };
    await model.sendMessage(message);

    expect(runtimeModel.agent.invoke_callFunctionOn).not.toHaveBeenCalled();
    expect(runtimeModel.agent.invoke_evaluate).toHaveBeenCalledTimes(1);
    const call = runtimeModel.agent.invoke_evaluate.mock.calls[0][0];
    expect(call.expression).toContain('sendMessage("rozenite"');

    // Only the message payload is double-stringified in this legacy fallback --
    // that's inherent to needing a JS string *literal* in `Runtime.evaluate`'s
    // source text, unlike the callFunctionOn path above. Evaluating the exact
    // expression must reproduce the original message.
    const sent = new Function(
      `let sent; globalThis.__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__ = { sendMessage: (_domain, m) => { sent = m; } }; ${call.expression}; return sent;`,
    )();
    expect(JSON.parse(sent)).toEqual(message);
  });

  it('sends via Runtime.callFunctionOn with a single-stringified by-value argument', async () => {
    const model = createModel();
    model.mainExecutionContextId = 11;

    const message = { pluginId: 'p', type: 'ping', payload: { n: 1 } };
    await model.sendMessage(message);

    expect(runtimeModel.agent.invoke_callFunctionOn).toHaveBeenCalledTimes(1);
    const call = runtimeModel.agent.invoke_callFunctionOn.mock.calls[0][0];

    expect(call.executionContextId).toBe(11);
    expect(call.functionDeclaration).toContain('sendMessage("rozenite", m)');
    expect(call.arguments).toHaveLength(1);

    const argValue = call.arguments[0].value;
    // A single stringify only: parsing it once yields the plain object, not a
    // JSON string that would need parsing a second time (the double-stringify
    // this path replaced).
    expect(typeof argValue).toBe('string');
    const parsed = JSON.parse(argValue);
    expect(parsed).toEqual(message);
  });

  it('does not await the round trip but reports a runtime exception (exceptionDetails) instead of swallowing it', async () => {
    const model = createModel();
    model.mainExecutionContextId = 1;
    let resolveSend!: (value: ReturnType<typeof okResponse>) => void;
    runtimeModel.agent.invoke_callFunctionOn.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve;
      }),
    );

    const sendPromise = model.sendMessage({ hello: 'world' });

    // `sendMessage` must resolve without waiting for the CDP round trip: the
    // `invoke_callFunctionOn` promise above is still pending (`resolveSend` has
    // not been called yet), yet `sendPromise` already settles.
    await expect(sendPromise).resolves.toBeUndefined();

    resolveSend(okResponse({ exceptionDetails: { text: 'boom' } }));
    await flushMicrotasks();

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });

  it('reports a protocol-level failure (getError(), not exceptionDetails) instead of swallowing it', async () => {
    // The real agent's `invoke_*` methods never reject -- a protocol error (e.g.
    // a stale execution context id after a reload, the scenario this exercises)
    // resolves with `getError()` set rather than throwing. A prior version of
    // this send path only checked `exceptionDetails` and had a dead `.catch()`,
    // which meant this exact failure mode was silently dropped.
    const model = createModel();
    model.mainExecutionContextId = 1;
    runtimeModel.agent.invoke_callFunctionOn.mockResolvedValue(
      okResponse({ getError: () => 'Cannot find context with specified id', result: {} }),
    );

    await model.sendMessage({ hello: 'world' });
    await flushMicrotasks();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Cannot find context with specified id'),
    );
  });

  it('resolves an existing main execution context when listeners are attached (initial-context race)', () => {
    existingContexts = [
      { id: 3, name: 'other' },
      { id: 42, name: 'main' },
    ];
    const model = createModel();

    model.initializeExecutionContextListeners();

    expect(model.mainExecutionContextId).toBe(42);
  });

  it('re-captures the execution context id on reload (create -> destroy -> create)', () => {
    const model = createModel();
    model.initializeExecutionContextListeners();
    expect(model.mainExecutionContextId).toBeNull();

    model.onExecutionContextCreated({ data: { name: 'main', id: 1 } });
    expect(model.mainExecutionContextId).toBe(1);

    model.onExecutionContextDestroyed({ data: { name: 'main', id: 1 } });
    expect(model.mainExecutionContextId).toBeNull();

    model.onExecutionContextCreated({ data: { name: 'main', id: 2 } });
    expect(model.mainExecutionContextId).toBe(2);
  });

  it('does not clear the execution context id when a non-matching context is destroyed', () => {
    const model = createModel();
    model.initializeExecutionContextListeners();

    model.onExecutionContextCreated({ data: { name: 'main', id: 1 } });
    // A stale destroy event for a previous, already-replaced context id must
    // not clobber the currently active one.
    model.onExecutionContextDestroyed({ data: { name: 'main', id: 999 } });

    expect(model.mainExecutionContextId).toBe(1);
  });

  it('ignores execution contexts that are not the main context', () => {
    const model = createModel();
    model.initializeExecutionContextListeners();

    model.onExecutionContextCreated({ data: { name: 'worker', id: 1 } });

    expect(model.mainExecutionContextId).toBeNull();
  });
});

// `sanitizeUnpairedSurrogates` operates on the *output* of `JSON.stringify`, not
// on a raw JS string. Modern (ES2019+ "well-formed") `JSON.stringify` never
// emits a lone surrogate as a raw UTF-16 code unit -- it always escapes it to a
// literal six-character `\uXXXX` sequence. So the function has to look for that
// escape sequence text, not for raw surrogate code units (which, for a lone
// surrogate, will never appear post-stringify).
describe('sanitizeUnpairedSurrogates', () => {
  it('leaves ordinary text untouched', () => {
    const input = JSON.stringify('He said "hi"\nnewline\ttab \\backslash');
    expect(sanitizeUnpairedSurrogates(input)).toBe(input);
  });

  it('preserves valid surrogate pairs (emoji), which JSON.stringify never escapes', () => {
    const input = JSON.stringify('party 🎉 time');
    expect(input).not.toMatch(/\\u[dD][89a-fA-F]/);
    expect(sanitizeUnpairedSurrogates(input)).toBe(input);
  });

  it('does not mangle U+2028 or U+2029', () => {
    const input = JSON.stringify('line  sep and para  sep');
    expect(sanitizeUnpairedSurrogates(input)).toBe(input);
  });

  it('replaces an unpaired high-surrogate escape sequence produced by JSON.stringify', () => {
    const input = JSON.stringify('broken \uD800 surrogate');
    expect(input).toContain('\\ud800');
    expect(sanitizeUnpairedSurrogates(input)).toBe(JSON.stringify('broken � surrogate'));
  });

  it('replaces an unpaired low-surrogate escape sequence produced by JSON.stringify', () => {
    const input = JSON.stringify('broken \uDC00 surrogate');
    expect(sanitizeUnpairedSurrogates(input)).toBe(JSON.stringify('broken � surrogate'));
  });

  it('makes a real device-rejected payload safe: no unpaired escape sequence survives', () => {
    // Verified against a real device: a lone surrogate escape (properly escaped
    // by JSON.stringify, syntactically valid JSON) is still rejected by the
    // device's stricter JSON parser with "expected another unicode escape for
    // second half of surrogate pair", surfacing as an uncorrelatable `id: null`.
    const serialized = JSON.stringify({ payload: { value: 'before-\uD800-after' } });
    const sanitized = sanitizeUnpairedSurrogates(serialized);
    expect(sanitized).not.toMatch(/\\u[dD][89a-fA-F][0-9a-fA-F]{2}/);
    expect(() => JSON.parse(sanitized)).not.toThrow();
  });
});
