import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DISPATCHER_INIT_MAX_ATTEMPTS,
  DISPATCHER_INIT_RETRY_MS,
  HandshakeCancelledError,
  REACT_DEVTOOLS_DOMAIN,
  ROZENITE_DOMAIN,
  RozeniteMissingError,
  buildBindingNameExpression,
  buildDispatcherReadyExpression,
  buildInitializeDomainExpression,
  runDispatcherHandshake,
  type HandshakeErrorMessages,
  type HandshakeEvaluateResult,
  type HandshakeTransport,
} from '../protocol.js';

const errors: HandshakeErrorMessages = {
  dispatcherWaitFailed: (d) => new Error(`wait failed: ${d.text}`),
  bindingNameFailed: (d) => new Error(`binding failed: ${d.text}`),
  invalidBindingName: (v) => new Error(`invalid binding: ${String(v)}`),
};

const createTransport = (
  respond: (expression: string, count: number) => HandshakeEvaluateResult,
  calls: string[] = [],
) => {
  let evaluates = 0;
  const transport: HandshakeTransport = {
    evaluate: vi.fn(async (expression: string, returnByValue: boolean) => {
      evaluates += 1;
      calls.push(`evaluate:${expression}:${returnByValue}`);
      return respond(expression, evaluates);
    }),
    addBinding: vi.fn(async (name: string) => {
      calls.push(`addBinding:${name}`);
    }),
  };
  return { transport, calls, evaluates: () => evaluates };
};

const happy = (expression: string): HandshakeEvaluateResult => {
  if (expression === buildDispatcherReadyExpression()) return { result: { value: true } };
  if (expression === buildBindingNameExpression()) return { result: { value: 'binding' } };
  return {};
};

describe('runDispatcherHandshake', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls, reads the binding name, adds the binding and initializes each domain in order', async () => {
    const { transport, calls } = createTransport(happy);
    await runDispatcherHandshake(transport, {
      domains: [ROZENITE_DOMAIN, REACT_DEVTOOLS_DOMAIN],
      errors,
    });
    expect(calls).toEqual([
      `evaluate:${buildDispatcherReadyExpression()}:true`,
      `evaluate:${buildBindingNameExpression()}:false`,
      'addBinding:binding',
      `evaluate:${buildInitializeDomainExpression(ROZENITE_DOMAIN)}:false`,
      `evaluate:${buildInitializeDomainExpression(REACT_DEVTOOLS_DOMAIN)}:false`,
    ]);
  });

  it('keeps polling while readiness is undefined or false', async () => {
    const { transport, evaluates } = createTransport((expression, count) => {
      if (expression === buildDispatcherReadyExpression()) {
        if (count === 1) return { result: {} };
        if (count === 2) return { result: { value: false } };
        if (count === 3) return { result: { value: 'true' } };
        return { result: { value: true } };
      }
      return happy(expression);
    });
    const done = runDispatcherHandshake(transport, {
      domains: [ROZENITE_DOMAIN],
      errors,
    });
    await vi.advanceTimersByTimeAsync(DISPATCHER_INIT_RETRY_MS * 3);
    await done;
    expect(evaluates()).toBe(4 + 2);
  });

  it('rejects with RozeniteMissingError after exactly 19 evaluates and 19 waits', async () => {
    const { transport, evaluates } = createTransport(() => ({ result: { value: false } }));
    const done = runDispatcherHandshake(transport, { domains: [ROZENITE_DOMAIN], errors });
    const settled = vi.fn();
    const assertion = expect(done).rejects.toBeInstanceOf(RozeniteMissingError);
    done.then(settled, settled);

    // The last evaluate is followed by a full sleep before giving up.
    await vi.advanceTimersByTimeAsync(DISPATCHER_INIT_RETRY_MS * 19 - 1);
    expect(settled).not.toHaveBeenCalled();
    expect(evaluates()).toBe(19);

    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(evaluates()).toBe(19);
    expect(DISPATCHER_INIT_MAX_ATTEMPTS - 1).toBe(19);
    expect(transport.addBinding).not.toHaveBeenCalled();
  });

  it('names the missing-Rozenite error', () => {
    const error = new RozeniteMissingError();
    expect(error.name).toBe('RozeniteMissingError');
    expect(error.message).toContain('Rozenite runtime was not found in the app.');
  });

  it('maps an exception while polling through the host message', async () => {
    const { transport } = createTransport(() => ({
      exceptionDetails: { text: 'boom' },
    }));
    await expect(
      runDispatcherHandshake(transport, { domains: [ROZENITE_DOMAIN], errors }),
    ).rejects.toThrow('wait failed: boom');
  });

  it('maps an exception while reading the binding name', async () => {
    const { transport } = createTransport((expression) =>
      expression === buildBindingNameExpression()
        ? { exceptionDetails: { text: 'nope' } }
        : happy(expression),
    );
    await expect(
      runDispatcherHandshake(transport, { domains: [ROZENITE_DOMAIN], errors }),
    ).rejects.toThrow('binding failed: nope');
  });

  it.each([[undefined], [null], [''], [42]])('rejects binding name %j', async (value) => {
    const { transport } = createTransport((expression) =>
      expression === buildBindingNameExpression() ? { result: { value } } : happy(expression),
    );
    await expect(
      runDispatcherHandshake(transport, {
        domains: [ROZENITE_DOMAIN],
        errors,
      }),
    ).rejects.toThrow(`invalid binding: ${String(value)}`);
    expect(transport.addBinding).not.toHaveBeenCalled();
  });

  it('runs the hook between the poll and the binding name read, and per-domain hooks in order', async () => {
    const calls: string[] = [];
    const { transport } = createTransport(happy, calls);
    await runDispatcherHandshake(transport, {
      domains: [ROZENITE_DOMAIN, REACT_DEVTOOLS_DOMAIN],
      errors,
      afterDispatcherReady: async () => {
        calls.push('hook');
      },
      afterDomainInitialized: async (domain) => {
        calls.push(`after:${domain}`);
      },
    });
    expect(calls).toEqual([
      `evaluate:${buildDispatcherReadyExpression()}:true`,
      'hook',
      `evaluate:${buildBindingNameExpression()}:false`,
      'addBinding:binding',
      `evaluate:${buildInitializeDomainExpression(ROZENITE_DOMAIN)}:false`,
      `after:${ROZENITE_DOMAIN}`,
      `evaluate:${buildInitializeDomainExpression(REACT_DEVTOOLS_DOMAIN)}:false`,
      `after:${REACT_DEVTOOLS_DOMAIN}`,
    ]);
  });

  it('propagates transport and hook errors unchanged', async () => {
    const failure = new Error('socket closed');
    const { transport } = createTransport(happy);
    vi.mocked(transport.addBinding).mockRejectedValueOnce(failure);
    await expect(
      runDispatcherHandshake(transport, { domains: [ROZENITE_DOMAIN], errors }),
    ).rejects.toBe(failure);
  });

  it.each(['afterDispatcherReady', 'afterDomainInitialized'] as const)(
    'propagates a rejection from %s unchanged',
    async (hook) => {
      const failure = new Error(`${hook} failed`);
      const { transport } = createTransport(happy);
      await expect(
        runDispatcherHandshake(transport, {
          domains: [ROZENITE_DOMAIN],
          errors,
          [hook]: async () => {
            throw failure;
          },
        }),
      ).rejects.toBe(failure);
    },
  );

  describe('cancellation', () => {
    it('cancels before the first poll', async () => {
      const { transport } = createTransport(happy);
      await expect(
        runDispatcherHandshake(transport, {
          domains: [ROZENITE_DOMAIN],
          errors,
          isCancelled: () => true,
        }),
      ).rejects.toMatchObject({
        name: 'HandshakeCancelledError',
        step: 'wait-for-dispatcher',
      });
      expect(transport.evaluate).not.toHaveBeenCalled();
    });

    it('cancels mid-poll, after the wait', async () => {
      let cancelled = false;
      const { transport, evaluates } = createTransport(() => ({
        result: { value: false },
      }));
      const done = runDispatcherHandshake(transport, {
        domains: [ROZENITE_DOMAIN],
        errors,
        isCancelled: () => cancelled,
      });
      const assertion = expect(done).rejects.toBeInstanceOf(HandshakeCancelledError);
      await vi.advanceTimersByTimeAsync(DISPATCHER_INIT_RETRY_MS);
      cancelled = true;
      await vi.advanceTimersByTimeAsync(DISPATCHER_INIT_RETRY_MS);
      await assertion;
      expect(evaluates()).toBe(2);
    });

    it.each([
      ['before-binding', 'evaluate:ready'],
      ['read-binding-name', 'hook'],
      ['add-binding', 'evaluate:binding'],
      ['initialize-domain', 'addBinding'],
    ] as const)('cancels at %s', async (step, after) => {
      let cancelled = false;
      const calls: string[] = [];
      const { transport } = createTransport(happy, calls);
      // Flip the flag right after the named call so the next check sees it.
      const flipIf = (label: string) => {
        if (label === after) cancelled = true;
      };
      const ev = transport.evaluate;
      transport.evaluate = async (expression, returnByValue) => {
        const result = await ev(expression, returnByValue);
        if (expression === buildDispatcherReadyExpression()) flipIf('evaluate:ready');
        if (expression === buildBindingNameExpression()) flipIf('evaluate:binding');
        return result;
      };
      const add = transport.addBinding;
      transport.addBinding = async (name) => {
        await add(name);
        flipIf('addBinding');
      };
      await expect(
        runDispatcherHandshake(transport, {
          domains: [ROZENITE_DOMAIN],
          errors,
          isCancelled: () => cancelled,
          afterDispatcherReady: async () => {
            flipIf('hook');
          },
        }),
      ).rejects.toMatchObject({ step });
      // Nothing after the cancelled step ran.
      expect(calls.some((c) => c.includes(buildInitializeDomainExpression(ROZENITE_DOMAIN)))).toBe(
        false,
      );
    });

    it('cancels before reading the binding name when there is no ready hook', async () => {
      let cancelled = false;
      const { transport } = createTransport((expression) => {
        if (expression === buildDispatcherReadyExpression()) cancelled = true;
        return happy(expression);
      });
      await expect(
        runDispatcherHandshake(transport, {
          domains: [ROZENITE_DOMAIN],
          errors,
          isCancelled: () => cancelled,
        }),
      ).rejects.toMatchObject({ step: 'read-binding-name' });
      expect(transport.evaluate).toHaveBeenCalledTimes(1);
    });

    it('cancels between domains', async () => {
      let cancelled = false;
      const { transport, calls } = createTransport(happy);
      await expect(
        runDispatcherHandshake(transport, {
          domains: [ROZENITE_DOMAIN, REACT_DEVTOOLS_DOMAIN],
          errors,
          isCancelled: () => cancelled,
          afterDomainInitialized: async () => {
            cancelled = true;
          },
        }),
      ).rejects.toMatchObject({ step: 'initialize-domain' });
      expect(calls.filter((c) => c.includes('initializeDomain'))).toHaveLength(1);
    });
  });
});
