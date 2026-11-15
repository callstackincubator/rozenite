import '../../__tests__/helpers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Transition } from '../../shared/protocol';
import {
  __resetRegistry,
  editStoreValue,
  getStoreAdapter,
  hello,
  invokeStoreAction,
  jumpTo,
} from '../../runtime/store-registry';
import { encodeValue } from '../../shared/codec';
import { observeStoreImpl } from '../observe';

type Counter = { count: number; inc: (by: number) => void };

const createCounter = () =>
  createStore<Counter>()((set) => ({
    count: 0,
    inc: (by) => set((state) => ({ count: state.count + by })),
  }));

const transitionsOf = (storeId: string): Transition[] =>
  hello().transitions.filter((transition) => transition.storeId === storeId);

const summary = (storeId: string) =>
  transitionsOf(storeId).map(({ action }) => `${action.source}:${action.name}`);

beforeEach(() => {
  __resetRegistry();
});

describe('observeStore()', () => {
  it('records changes to an unwrapped store as observed, with their diffs', () => {
    const store = createCounter();
    observeStoreImpl(store, { name: 'Counter' });

    store.getState().inc(2);
    store.setState({ count: 5 });

    expect(summary('Counter')).toEqual(['observed:change', 'observed:change']);
    expect(transitionsOf('Counter')[1].patches).toEqual([
      expect.objectContaining({ path: ['count'], value: 5 }),
    ]);
    expect(hello().stores.map((store) => store.actions.map((action) => action.path))).toEqual([
      ['inc'],
    ]);
  });

  it('names what the panel does: calling an action and editing a value', async () => {
    const store = createCounter();
    observeStoreImpl(store, { name: 'Counter' });

    await invokeStoreAction('Counter', 'inc', [encodeValue(3)]);
    editStoreValue('Counter', ['count'], encodeValue(10));

    expect(summary('Counter')).toEqual(['action:inc', 'edit:edit count']);
    expect(store.getState().count).toBe(10);
  });

  it('jumps back without recording the jump and keeps the live actions', () => {
    const store = createCounter();
    observeStoreImpl(store, { name: 'Counter' });
    const { inc } = store.getState();

    inc(1);
    inc(1);
    jumpTo('Counter', 1);

    expect(store.getState().count).toBe(1);
    expect(store.getState().inc).toBe(inc);
    expect(transitionsOf('Counter')).toHaveLength(2);
  });

  it('stops recording when disposed, and observing again does not record twice', () => {
    const store = createCounter();
    observeStoreImpl(store, { name: 'Counter' });
    const stop = observeStoreImpl(store, { name: 'Counter' });

    store.getState().inc(1);
    expect(summary('Counter')).toEqual(['reload:♻ reloaded', 'observed:change']);
    expect(hello().warnings).toEqual([]);

    stop();
    store.getState().inc(1);
    expect(transitionsOf('Counter')).toHaveLength(2);
  });

  it('labels persist hydration and serves persist info', async () => {
    const storage = new Map<string, string>([
      ['counter', JSON.stringify({ state: { count: 7 }, version: 0 })],
    ]);
    const store = createStore<Counter>()(
      persist((set) => ({ count: 0, inc: (by) => set((state) => ({ count: state.count + by })) }), {
        name: 'counter',
        skipHydration: true,
        storage: createJSONStorage(() => ({
          getItem: (key) => storage.get(key) ?? null,
          setItem: (key, value) => void storage.set(key, value),
          removeItem: (key) => void storage.delete(key),
        })),
      }),
    );
    observeStoreImpl(store, { name: 'Counter' });

    await getStoreAdapter('Counter').persistCommand('rehydrate');

    expect(store.getState().count).toBe(7);
    expect(summary('Counter')).toEqual(['hydrate:persist/rehydrate']);
    expect(getStoreAdapter('Counter').getPersistInfo()).toEqual({
      storageKey: 'counter',
      version: 0,
      hasHydrated: true,
    });
  });

  it('does nothing when disabled', () => {
    const store = createCounter();
    observeStoreImpl(store, { name: 'Counter', enabled: false });
    store.getState().inc(1);
    expect(hello().stores).toEqual([]);
  });
});

describe('observeStore() types', () => {
  it('accepts a bound store hook from create()', async () => {
    const { create } = await import('zustand');
    const useCounter = create<Counter>()((set) => ({
      count: 0,
      inc: (by) => set((state) => ({ count: state.count + by })),
    }));
    observeStoreImpl(useCounter, { name: 'Hook' });
    useCounter.getState().inc(1);
    expect(summary('Hook')).toEqual(['observed:change']);
  });
});
