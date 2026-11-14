import { createTracked } from '../../__tests__/helpers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZustandStoreEvent } from '../../shared/protocol';
import { createZustandHandlers } from '../bridge';
import {
  PANEL_IDLE_MS,
  __resetRegistry,
  dropIdleListener,
  isPanelListening,
} from '../store-registry';

const panel = (events: ZustandStoreEvent[] = []) =>
  createZustandHandlers((event) => events.push(event));

beforeEach(() => {
  __resetRegistry();
  vi.useFakeTimers();
});

type Auth = { token: string; count: number; inc: () => void };
const createAuth = (maxAge?: number) =>
  createTracked<Auth>(
    'Auth',
    (set) => ({
      token: 'secret-1',
      count: 0,
      inc: () => set((state) => ({ count: state.count + 1 })),
    }),
    { maxAge, stateSanitizer: (state) => ({ ...(state as object), token: '***' }) },
  );

describe('jump', () => {
  it('restores the recorded state itself, not the sanitized copy the panel holds', async () => {
    const store = createAuth();
    const events: ZustandStoreEvent[] = [];
    const handlers = panel(events);
    const base = (await handlers.hello()).keyframes[0];
    expect(base.state).toMatchObject({ token: '***' });
    store.setState({ token: 'secret-2' });
    store.getState().inc();

    await handlers.jump({ storeId: 'Auth', seq: base.seq });

    expect(store.getState()).toMatchObject({ token: 'secret-1', count: 0 });
    expect(events).toContainEqual({
      type: 'store-update',
      store: expect.objectContaining({ storeId: 'Auth', jumpedTo: base.seq }),
    });
  });

  it('sends a keyframe with the first transition after a jump, and ends the jump', async () => {
    const store = createAuth();
    const events: ZustandStoreEvent[] = [];
    const handlers = panel(events);
    await handlers.hello();
    store.getState().inc();
    store.getState().inc();
    vi.runAllTimers();

    await handlers.jump({ storeId: 'Auth', seq: 1 });
    store.getState().inc();
    vi.runAllTimers();

    const batch = events.filter((event) => event.type === 'transitions').pop();
    expect(batch).toMatchObject({
      transitions: [{ seq: 3, action: { name: 'inc' } }],
      keyframes: [{ seq: 3, state: { count: 2 } }],
    });
    const greeting = await handlers.hello();
    expect(greeting.stores[0].jumpedTo).toBeUndefined();
    expect(greeting.keyframes.map((keyframe) => keyframe.seq)).toEqual([0, 3]);
  });

  it('refuses a state the device no longer holds', async () => {
    const store = createAuth(2);
    const handlers = panel();
    await handlers.hello();
    store.getState().inc();
    store.getState().inc();
    store.getState().inc();

    await expect(handlers.jump({ storeId: 'Auth', seq: 0 })).rejects.toThrow(/no longer held/);
    await handlers.jump({ storeId: 'Auth', seq: 1 });
    expect(store.getState().count).toBe(1);
  });
});

describe('editPath', () => {
  it('records an edit transition and keeps the live actions on a whole-state edit', async () => {
    const store = createAuth();
    const events: ZustandStoreEvent[] = [];
    const handlers = panel(events);
    await handlers.hello();

    await handlers.editPath({ storeId: 'Auth', path: ['count'], value: 5 });
    await handlers.editPath({
      storeId: 'Auth',
      path: [],
      value: { token: 't', count: 7, inc: { $t: 'fn', name: 'inc', arity: 0 } },
    });
    vi.runAllTimers();

    store.getState().inc();
    expect(store.getState()).toMatchObject({ token: 't', count: 8 });
    const transitions = events.flatMap((event) =>
      event.type === 'transitions' ? event.transitions : [],
    );
    expect(transitions.map((transition) => transition.action)).toEqual([
      expect.objectContaining({ name: 'edit count', source: 'edit' }),
      expect.objectContaining({ name: 'edit $', source: 'edit' }),
    ]);
  });
});

describe('panel liveness', () => {
  it('stops streaming to a panel that went quiet, and says so when it pings again', async () => {
    const handlers = panel();
    await handlers.hello();
    dropIdleListener(Date.now() + PANEL_IDLE_MS / 2);
    expect(await handlers.ping()).toMatchObject({ listening: true });

    dropIdleListener(Date.now() + PANEL_IDLE_MS + 1);

    expect(isPanelListening()).toBe(false);
    expect(await handlers.ping()).toMatchObject({ listening: false });
    await handlers.hello();
    expect(isPanelListening()).toBe(true);
  });
});
