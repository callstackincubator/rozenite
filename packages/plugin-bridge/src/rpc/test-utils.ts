import { vi } from 'vitest';
import { RozeniteDevToolsClient } from '../client.js';

type Listener = (payload: unknown) => void;

/**
 * A minimal in-memory pair of fake `RozeniteDevToolsClient`s: sending on one
 * dispatches (asynchronously, like a real transport) to the other's
 * listeners, and vice versa.
 */
export const createFakeClientPair = () => {
  const listenersA = new Map<string, Set<Listener>>();
  const listenersB = new Map<string, Set<Listener>>();

  let droppedFromAtoB = false;
  let droppedFromBtoA = false;
  let delayAtoBMs = 0;
  let delayBtoAMs = 0;

  const dispatch = (
    listeners: Map<string, Set<Listener>>,
    type: string,
    payload: unknown,
    delayMs: number,
  ) => {
    const run = () => {
      listeners.get(type)?.forEach((listener) => listener(payload));
    };
    if (delayMs > 0) {
      setTimeout(run, delayMs);
    } else {
      // Real transports are never synchronous — queue on the (real, never
      // faked) native microtask queue so send() never re-enters a handler
      // synchronously.
      Promise.resolve().then(run);
    }
  };

  const clientA: RozeniteDevToolsClient<Record<string, unknown>> = {
    send: vi.fn((type, payload) => {
      if (droppedFromAtoB) return;
      dispatch(listenersB, type as string, payload, delayAtoBMs);
    }),
    onMessage: vi.fn((type, listener) => {
      const set = listenersA.get(type as string) ?? new Set();
      set.add(listener as Listener);
      listenersA.set(type as string, set);
      return {
        remove: () => set.delete(listener as Listener),
      };
    }),
    close: vi.fn(),
  };

  const clientB: RozeniteDevToolsClient<Record<string, unknown>> = {
    send: vi.fn((type, payload) => {
      if (droppedFromBtoA) return;
      dispatch(listenersA, type as string, payload, delayBtoAMs);
    }),
    onMessage: vi.fn((type, listener) => {
      const set = listenersB.get(type as string) ?? new Set();
      set.add(listener as Listener);
      listenersB.set(type as string, set);
      return {
        remove: () => set.delete(listener as Listener),
      };
    }),
    close: vi.fn(),
  };

  return {
    clientA,
    clientB,
    /** Drop every frame sent from A to B (simulates B never mounting). */
    dropAtoB: (drop: boolean) => {
      droppedFromAtoB = drop;
    },
    /** Drop every frame sent from B to A. */
    dropBtoA: (drop: boolean) => {
      droppedFromBtoA = drop;
    },
    delayAtoB: (ms: number) => {
      delayAtoBMs = ms;
    },
    delayBtoA: (ms: number) => {
      delayBtoAMs = ms;
    },
  };
};
