// Drives translateHostMessage through the exact host -> device command
// sequence packages/app/src/connection/device-connection.ts issues on every
// fresh socket (see socket.onopen and runBootstrap), in order, and asserts
// exactly which steps the bridge answers locally versus forwards — this is
// the scenario the whole translation table exists to make work.
import { describe, expect, it } from 'vitest';
import { translateHostMessage } from '../translate-host-message.js';

const RUNTIME_GLOBAL = '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__';

describe('the 7-step bootstrap sequence', () => {
  it('answers steps 1 and 5 locally and forwards everything else, ids intact', () => {
    let nextId = 1;
    const send = (method: string, params?: Record<string, unknown>) => {
      const id = nextId++;
      const raw = JSON.stringify({ id, method, params });
      return { id, action: translateHostMessage(raw) };
    };

    // 1. ReactNativeApplication.enable — answered locally, never forwarded.
    const step1 = send('ReactNativeApplication.enable');
    expect(step1.action).toEqual({ kind: 'reply', message: { id: step1.id, result: {} } });

    // 2. Runtime.enable — forwarded.
    const step2 = send('Runtime.enable');
    expect(step2.action).toEqual({
      kind: 'forward',
      message: { id: step2.id, method: 'Runtime.enable', params: undefined },
    });

    // 3. Runtime.evaluate (dispatcher poll) — forwarded. Exercised twice to
    // stand in for the up-to-19x retry loop: every attempt must forward
    // identically, none of them are ever answered locally.
    for (let attempt = 0; attempt < 2; attempt++) {
      const step3 = send('Runtime.evaluate', {
        expression: `globalThis.${RUNTIME_GLOBAL} != undefined`,
        returnByValue: true,
      });
      expect(step3.action.kind).toBe('forward');
      if (step3.action.kind === 'forward') {
        expect((step3.action.message as { id: number }).id).toBe(step3.id);
      }
    }

    // 4. Runtime.evaluate (read BINDING_NAME) — forwarded.
    const step4 = send('Runtime.evaluate', { expression: `${RUNTIME_GLOBAL}.BINDING_NAME` });
    expect(step4.action.kind).toBe('forward');

    // 5. Runtime.addBinding — answered locally, never forwarded.
    const step5 = send('Runtime.addBinding', { name: 'some-binding-name' });
    expect(step5.action).toEqual({ kind: 'reply', message: { id: step5.id, result: {} } });

    // 6. Runtime.evaluate (initializeDomain) — forwarded.
    const step6 = send('Runtime.evaluate', {
      expression: `void ${RUNTIME_GLOBAL}.initializeDomain(${JSON.stringify('rozenite')})`,
    });
    expect(step6.action.kind).toBe('forward');

    // 7. Runtime.evaluate (sendMessage, one per outbound plugin message) —
    // forwarded, exercised for two distinct outbound messages.
    for (const payload of [{ pluginId: 'a' }, { pluginId: 'b' }]) {
      const serialized = JSON.stringify(payload);
      const escaped = JSON.stringify(serialized);
      const step7 = send('Runtime.evaluate', {
        expression: `${RUNTIME_GLOBAL}.sendMessage(${JSON.stringify('rozenite')}, ${escaped})`,
      });
      expect(step7.action.kind).toBe('forward');
      if (step7.action.kind === 'forward') {
        const message = step7.action.message as {
          id: number;
          params: { expression: string };
        };
        expect(message.id).toBe(step7.id);
        // The escaped JSON payload travels through untouched.
        expect(message.params.expression).toContain(escaped);
      }
    }
  });

  it('answers Runtime.addBinding and ReactNativeApplication.enable with the caller-provided id, whatever it is', () => {
    const idsToTry = [1, 999, 0, -1];
    for (const id of idsToTry) {
      const bindingAction = translateHostMessage(
        JSON.stringify({ id, method: 'Runtime.addBinding', params: { name: 'x' } }),
      );
      expect(bindingAction).toEqual({ kind: 'reply', message: { id, result: {} } });

      const enableAction = translateHostMessage(
        JSON.stringify({ id, method: 'ReactNativeApplication.enable' }),
      );
      expect(enableAction).toEqual({ kind: 'reply', message: { id, result: {} } });
    }
  });
});
