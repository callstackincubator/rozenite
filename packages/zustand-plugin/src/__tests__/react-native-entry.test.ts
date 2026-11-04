import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createStore } from 'zustand/vanilla';

/**
 * The production path of the entry ships in release builds. The stubs
 * must be inert pass-throughs: a store wrapped in rozenite() behaves exactly
 * like an unwrapped one, and nothing is installed on the global object.
 */
const originalNodeEnv = process.env.NODE_ENV;
const target = globalThis as { window?: unknown };

beforeAll(() => {
  process.env.NODE_ENV = 'production';
  // Without a `window` the entry takes its server branch, which is the
  // same no-op: the NODE_ENV check would go untested.
  target.window = globalThis;
});

afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
  delete target.window;
});

describe('entry, production build', () => {
  it('turns rozenite() into the bare initializer', async () => {
    const { rozenite } = await import('../../react-native');
    const initializer = (set: (partial: { count: number }) => void) => ({
      count: 0,
      inc: () => set({ count: 1 }),
    });

    expect(rozenite(initializer as never, { name: 'Counter' })).toBe(initializer);

    const store = createStore(rozenite(initializer as never, { name: 'Counter' }) as never) as {
      getState: () => { count: number; inc: () => void };
    };
    store.getState().inc();
    expect(store.getState().count).toBe(1);
  });

  it('makes the agent tools hook a no-op', async () => {
    const { useZustandAgentTools } = await import('../../react-native');
    expect(useZustandAgentTools()).toBeUndefined();
  });
});
