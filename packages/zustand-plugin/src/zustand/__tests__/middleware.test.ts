import { createTracked, type TrackedSet } from '../../__tests__/helpers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware';
import type { Transition } from '../../shared/protocol';
import {
  __resetRegistry,
  getStoreAdapter,
  hello,
  jumpTo,
  setEventListener,
} from '../../runtime/store-registry';
import { rozeniteImpl } from '../middleware';

type Cart = {
  items: string[];
  user: string | null;
  loading: boolean;
  add: (item: string) => void;
  fetchUser: (id: number) => Promise<void>;
  fetchCart: () => Promise<void>;
};

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};

const createCart = (name = 'Cart', gates: Record<string, ReturnType<typeof deferred>> = {}) =>
  createTracked<Cart>(name, (set) => ({
    items: [],
    user: null,
    loading: false,
    add: (item) => set({ items: [item] }),
    fetchUser: async () => {
      set({ loading: true });
      await gates.user?.promise;
      set({ user: 'Ada', loading: false });
    },
    fetchCart: async () => {
      await gates.cart?.promise;
      set({ items: ['from server'] });
    },
  }));

const transitionsOf = (storeId: string): Transition[] =>
  hello().transitions.filter((transition) => transition.storeId === storeId);

beforeEach(() => {
  __resetRegistry();
});

afterEach(() => {
  setEventListener(null);
});

describe('rozenite() middleware', () => {
  it('names transitions after the store function that caused them, with arguments', () => {
    const store = createCart();
    store.getState().add('milk');

    const [transition] = transitionsOf('Cart');
    expect(transition.action).toMatchObject({ name: 'add', source: 'action', args: ['milk'] });
    expect(transition.patches).toEqual([{ op: 'add', path: ['items', 0], value: 'milk' }]);
  });

  it('attributes a set after an await to the single pending action', async () => {
    const gates = { user: deferred() };
    const store = createCart('Cart', gates);

    const pending = store.getState().fetchUser(7);
    gates.user.resolve();
    await pending;

    const [before, after] = transitionsOf('Cart');
    expect(before.action).toMatchObject({ name: 'fetchUser', source: 'action', args: [7] });
    expect(after.action).toMatchObject({ name: 'fetchUser', source: 'async', args: [7] });
  });

  it('leaves a set anonymous instead of guessing when several async actions are pending', async () => {
    const gates = { user: deferred(), cart: deferred() };
    const store = createCart('Cart', gates);

    const first = store.getState().fetchUser(1);
    const second = store.getState().fetchCart();
    gates.cart.resolve();
    await second;
    gates.user.resolve();
    await first;

    const ambiguous = transitionsOf('Cart').find((t) =>
      t.patches.some((p) => p.path[0] === 'items'),
    );
    expect(ambiguous?.action).toMatchObject({ name: 'anonymous', source: 'anonymous' });
  });

  it('labels explicit names and outside setState calls', () => {
    const store = createCart();
    (store.setState as TrackedSet<Cart>)({ loading: true }, false, 'ui/spinner');
    store.setState({ loading: false });

    const [named, external] = transitionsOf('Cart');
    expect(named.action).toMatchObject({ name: 'ui/spinner', source: 'named' });
    expect(external.action).toMatchObject({ name: 'setState', source: 'external' });
  });

  it('jumps back without recording the jump', () => {
    const store = createCart();
    store.getState().add('milk');

    jumpTo('Cart', 0);

    expect(store.getState().items).toEqual([]);
    store.getState().add('bread');
    expect(store.getState().items).toEqual(['bread']);
    expect(transitionsOf('Cart').map((t) => [t.seq, t.action.name])).toEqual([
      [1, 'add'],
      [2, 'add'],
    ]);
  });

  it('treats re-creating a store with the same name as Fast Refresh: one store, a reload marker', () => {
    createCart().getState().add('milk');
    createCart().getState().add('eggs');

    const { stores } = hello();
    expect(stores.map((s) => [s.storeId, s.generation])).toEqual([['Cart', 2]]);
    expect(transitionsOf('Cart').map((t) => t.action.name)).toEqual(['add', '♻ reloaded', 'add']);
  });

  it('warns once when two live stores share a name', () => {
    const events: unknown[] = [];
    hello();
    setEventListener((event) => events.push(event));
    const first = createCart();
    createCart();
    first.getState().add('milk');
    first.getState().add('eggs');

    const warnings = events.filter((e) => (e as { type: string }).type === 'warning');
    expect(warnings).toEqual([
      expect.objectContaining({ warning: expect.objectContaining({ code: 'duplicate-name' }) }),
    ]);
  });
});

describe('rozenite() alongside listeners and other middleware', () => {
  it('keeps selector subscriptions working with subscribeWithSelector outside it', () => {
    type Pair = { count: number; other: number };
    const store = createStore<Pair>()(
      subscribeWithSelector(
        rozeniteImpl((() => ({ count: 0, other: 0 })) as never, { name: 'Pair' }) as never,
      ) as never,
    ) as unknown as {
      setState: (partial: Partial<Pair>) => void;
      subscribe: (
        selector: (state: Pair) => number,
        listener: (slice: number, previous: number) => void,
      ) => () => void;
    };
    const onCount = vi.fn();
    store.subscribe((state) => state.count, onCount);

    store.setState({ other: 1 });
    store.setState({ count: 1 });

    expect(onCount.mock.calls).toEqual([[1, 0]]);
  });

  it('folds a set made by a listener into the transition that caused it', () => {
    type Pair = { a: number; b: number; setA: (a: number) => void };
    const store = createTracked<Pair>('Pair', (set) => ({ a: 0, b: 0, setA: (a) => set({ a }) }));
    store.subscribe((state, prev) => {
      if (state.a !== prev.a) store.setState({ b: state.a * 2 });
    });

    store.getState().setA(1);

    expect(store.getState()).toMatchObject({ a: 1, b: 2 });
    expect(
      transitionsOf('Pair').map((t) => [
        t.action.name,
        t.patches.map((patch) => patch.path.join('.')),
      ]),
    ).toEqual([['setA', ['a', 'b']]]);
  });

  it("does not credit a set to another store's pending action", async () => {
    const gates = { user: deferred() };
    const session = createCart('Session', gates);
    let tick!: () => void;
    createTracked<{ ticks: number }>('Controls', (set) => {
      tick = () => set({ ticks: 1 });
      return { ticks: 0 };
    });

    const pending = session.getState().fetchUser(1);
    tick();
    gates.user.resolve();
    await pending;

    expect(transitionsOf('Controls')[0].action).toMatchObject({
      name: 'anonymous',
      source: 'anonymous',
    });
  });

  it('hands back a thenable that is not a native promise untouched, without calling it', () => {
    const request = { then: vi.fn(), abort: vi.fn() };
    const store = createTracked('Api', () => ({ load: () => request }));

    const returned = store.getState().load();

    expect(returned).toBe(request);
    returned.abort();
    expect(request.abort).toHaveBeenCalled();
    expect(request.then).not.toHaveBeenCalled();
  });
});

describe('encoded size', () => {
  // Each level holds the same child twice: 2^17 paths to one leaf.
  const sharedGraph = (depth: number): unknown =>
    depth === 0 ? { leaf: true } : ((child) => ({ a: child, b: child }))(sharedGraph(depth - 1));

  it('warns once, on the device and in the panel, when shared references blow up a snapshot', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const events: { type: string; warning?: { code: string; message: string } }[] = [];
    createTracked('Graph', () => ({ graph: sharedGraph(17) }));
    createCart();
    setEventListener((event) => events.push(event as never));

    const first = hello();
    hello();

    const large = first.warnings.filter((warning) => warning.code === 'large-state');
    expect(large).toHaveLength(1);
    expect(large[0]).toMatchObject({ storeId: 'Graph' });
    expect(large[0].message).toMatch(/encoded to [\d,]+ values/);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(events.filter((event) => event.warning?.code === 'large-state')).toHaveLength(1);
    warn.mockRestore();
  });
});

describe('rozenite() with persist', () => {
  const createMemoryStorage = () => {
    const data = new Map<string, string>();
    return {
      data,
      storage: {
        getItem: (key: string) => Promise.resolve(data.get(key) ?? null),
        setItem: (key: string, value: string) => {
          data.set(key, value);
        },
        removeItem: (key: string) => {
          data.delete(key);
        },
      },
    };
  };

  it('names the hydration write, and writes time travel through to storage', async () => {
    const memory = createMemoryStorage();
    memory.data.set('cart', JSON.stringify({ state: { items: ['saved'] }, version: 0 }));

    const store = createStore<{ items: string[]; add: (item: string) => void }>()(
      rozeniteImpl(
        persist((set) => ({ items: [], add: (item: string) => set({ items: [item] }) }), {
          name: 'cart',
          storage: createJSONStorage(() => memory.storage),
        }) as never,
        { name: 'Cart' },
      ) as never,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.getState().items).toEqual(['saved']);
    expect(transitionsOf('Cart')[0].action).toMatchObject({
      name: 'persist/rehydrate',
      source: 'hydrate',
    });

    expect(getStoreAdapter('Cart').getPersistInfo()).toEqual({
      storageKey: 'cart',
      version: 0,
      hasHydrated: true,
    });

    store.getState().add('milk');
    jumpTo('Cart', 1);
    expect(store.getState().items).toEqual(['saved']);
    expect(JSON.parse(memory.data.get('cart') ?? '{}').state.items).toEqual(['saved']);
  });

  it('persists panel edits and records them as edits', async () => {
    const memory = createMemoryStorage();
    const store = createStore<{ items: string[] }>()(
      rozeniteImpl(
        persist(() => ({ items: [] as string[] }), {
          name: 'cart',
          storage: createJSONStorage(() => memory.storage),
        }) as never,
        { name: 'Cart' },
      ) as never,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const adapter = getStoreAdapter('Cart');
    const saved = () => JSON.parse(memory.data.get('cart') ?? '{}').state?.items;

    adapter.editState({ items: ['edited'] }, 'edit items');
    expect(store.getState().items).toEqual(['edited']);
    expect(saved()).toEqual(['edited']);
    expect(transitionsOf('Cart').at(-1)?.action).toMatchObject({
      name: 'edit items',
      source: 'edit',
    });

    await adapter.persistCommand('clear');
    expect(memory.data.has('cart')).toBe(false);
  });

  it('keeps the name of an outside setState that persist passes on without it', async () => {
    const memory = createMemoryStorage();
    const store = createStore<{ items: string[] }>()(
      rozeniteImpl(
        persist(() => ({ items: [] as string[] }), {
          name: 'cart',
          storage: createJSONStorage(() => memory.storage),
        }) as never,
        { name: 'Cart' },
      ) as never,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    (store.setState as (partial: unknown, replace?: boolean, name?: string) => void)(
      { items: ['x'] },
      false,
      'ui/add',
    );
    store.setState({ items: [] });

    expect(transitionsOf('Cart').map((t) => [t.action.name, t.action.source])).toEqual([
      ['persist/rehydrate', 'hydrate'],
      ['ui/add', 'named'],
      ['setState', 'external'],
    ]);
  });

  it('warns with a fix when persist sits outside rozenite()', async () => {
    const memory = createMemoryStorage();
    const events: { type: string; warning?: { code: string; fix?: string } }[] = [];
    hello();
    setEventListener((event) => events.push(event as never));

    createStore<{ items: string[] }>()(
      persist(rozeniteImpl((() => ({ items: [] })) as never, { name: 'Cart' }) as never, {
        name: 'cart',
        storage: createJSONStorage(() => memory.storage),
      }) as never,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(events.find((e) => e.type === 'warning')?.warning).toMatchObject({
      code: 'not-outermost',
      fix: expect.stringContaining('rozenite(persist('),
    });
  });
});
