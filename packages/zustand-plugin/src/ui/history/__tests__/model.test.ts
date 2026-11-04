import { describe, expect, it } from 'vitest';
import { encodeValue } from '../../../shared/codec';
import { diffStates } from '../../../shared/patch';
import type { StoreDescriptor, Transition } from '../../../shared/protocol';
import {
  applyHello,
  applyTransitions,
  canJump,
  createModel,
  currentState,
  exportHistory,
  jumpTargets,
  latestState,
  stateAt,
  updateDescriptor,
  upsertStore,
  type HistoryModel,
} from '../model';
import { matchesFilter, parseFilter } from '../filter';

const descriptor = (storeId = 'Cart', extra: Partial<StoreDescriptor> = {}): StoreDescriptor => ({
  storeId,
  name: storeId,
  actions: [],
  generation: 1,
  createdAt: 0,
  recording: true,
  maxAge: 50,
  ...extra,
});

/** Builds transitions the way the device does: diff consecutive real states. */
const transitionsFor = (storeId: string, states: unknown[], firstSeq = 1): Transition[] =>
  states.slice(1).map((next, index) => ({
    storeId,
    seq: firstSeq + index,
    timestamp: 1000 + index,
    action: { name: `step${index + 1}`, source: 'action' },
    patches: diffStates(states[index], next, { seq: firstSeq + index }),
  }));

const modelWith = (states: unknown[], maxHistory?: number): HistoryModel => {
  let model = createModel(maxHistory);
  model = upsertStore(model, descriptor(), {
    storeId: 'Cart',
    seq: 0,
    state: encodeValue(states[0]),
  });
  return applyTransitions(model, transitionsFor('Cart', states), []);
};

describe('history model', () => {
  const states = [
    { items: [] as number[], total: 0 },
    { items: [1], total: 1 },
    { items: [1, 2], total: 3 },
    { items: [1, 2], total: 3, coupon: 'X' },
    { items: [2], total: 2, coupon: 'X' },
  ];

  it('reconstructs every state from base + patches', () => {
    const model = modelWith(states);
    const history = model.stores.get('Cart')!;
    expect(history.entries).toHaveLength(4);
    states.forEach((state, index) => {
      expect(stateAt(history, index - 1)).toEqual(encodeValue(state));
    });
  });

  it('reconstructs across checkpoints and after trimming to maxHistory', () => {
    const many = Array.from({ length: 80 }, (_, index) => ({ count: index, label: `n${index}` }));
    const model = modelWith(many, 30);
    const history = model.stores.get('Cart')!;
    expect(history.entries).toHaveLength(30);
    expect(history.base.state).toEqual(encodeValue(many[49]));
    expect(latestState(history)).toEqual(encodeValue(many[79]));
    expect(stateAt(history, 10)).toEqual(encodeValue(many[60]));
  });

  it('deduplicates transitions replayed by a second hello', () => {
    const model = modelWith(states);
    const again = applyHello(
      { ...model, sessionId: 's1' },
      {
        sessionId: 's1',
        stores: [descriptor()],
        keyframes: [{ storeId: 'Cart', seq: 0, state: encodeValue(states[0]) }],
        transitions: transitionsFor('Cart', states),
      },
    );
    expect(again.stores.get('Cart')!.entries).toHaveLength(4);
  });

  it('starts over when the device session changes', () => {
    const model = { ...modelWith(states), sessionId: 'old' };
    const next = applyHello(model, {
      sessionId: 'new',
      stores: [descriptor()],
      keyframes: [{ storeId: 'Cart', seq: 0, state: encodeValue({ fresh: true }) }],
      transitions: [],
    });
    expect(next.stores.get('Cart')!.entries).toHaveLength(0);
    expect(latestState(next.stores.get('Cart')!)).toEqual({ fresh: true });
  });

  it('trusts a keyframe over the reconstructed state', () => {
    const model = modelWith(states);
    const wrong = encodeValue({ items: [9], total: 9 });
    const next = applyTransitions(model, [], [{ storeId: 'Cart', seq: 2, state: wrong }]);
    const history = next.stores.get('Cart')!;
    expect(stateAt(history, 1)).toEqual(wrong);
  });

  it('inserts a reload boundary when a store re-registers with a newer keyframe', () => {
    const model = modelWith(states);
    const next = upsertStore(
      model,
      { ...descriptor(), generation: 2 },
      {
        storeId: 'Cart',
        seq: 10,
        state: encodeValue({ items: [], total: 0 }),
      },
    );
    const history = next.stores.get('Cart')!;
    const last = history.entries[history.entries.length - 1];
    expect(last.action.source).toBe('reload');
    expect(last.seq).toBe(10);
    expect(latestState(history)).toEqual(encodeValue({ items: [], total: 0 }));
    // Transitions after the boundary still append.
    const after = applyTransitions(
      next,
      transitionsFor(
        'Cart',
        [
          { items: [], total: 0 },
          { items: [7], total: 7 },
        ],
        11,
      ),
      [],
    );
    expect(latestState(after.stores.get('Cart')!)).toEqual(encodeValue({ items: [7], total: 7 }));
  });

  it('exports the base, the keyframes and the transitions of each store', () => {
    const model = applyTransitions(
      modelWith(states),
      [],
      [{ storeId: 'Cart', seq: 2, state: encodeValue(states[2]) }],
    );
    const data = exportHistory(model);
    expect(data).toMatchObject({ format: 'rozenite-zustand-history', version: 1 });
    expect(data.stores[0].store).toEqual({ storeId: 'Cart', name: 'Cart' });
    expect(data.stores[0].keyframes.map((keyframe) => keyframe.seq)).toEqual([2]);
    expect(data.stores[0].transitions).toHaveLength(4);
  });
});

describe('jumps', () => {
  const states = [{ n: 0 }, { n: 1 }, { n: 2 }, { n: 3 }];

  it('shows the jumped-to state until a new transition arrives', () => {
    let model = modelWith(states);
    model = updateDescriptor(model, descriptor('Cart', { jumpedTo: 1 }));
    expect(currentState(model.stores.get('Cart')!)).toEqual(encodeValue({ n: 1 }));

    // The device diffs the next transition against the jumped-to state and
    // sends it with a keyframe.
    model = applyTransitions(model, transitionsFor('Cart', [{ n: 1 }, { n: 10 }], 4), [
      { storeId: 'Cart', seq: 4, state: encodeValue({ n: 10 }) },
    ]);
    const history = model.stores.get('Cart')!;
    expect(history.descriptor.jumpedTo).toBeUndefined();
    expect(currentState(history)).toEqual(encodeValue({ n: 10 }));
  });

  it('keeps the jump a hello reports, after replaying the transitions before it', () => {
    const model = applyHello(createModel(), {
      sessionId: 's1',
      stores: [descriptor('Cart', { jumpedTo: 0 })],
      keyframes: [{ storeId: 'Cart', seq: 0, state: encodeValue(states[0]) }],
      transitions: transitionsFor('Cart', states),
    });
    expect(currentState(model.stores.get('Cart')!)).toEqual(encodeValue({ n: 0 }));
  });

  it('offers only the states the device still holds', () => {
    let model = createModel();
    model = upsertStore(model, descriptor('Cart', { maxAge: 2 }), {
      storeId: 'Cart',
      seq: 0,
      state: encodeValue(states[0]),
    });
    model = applyTransitions(model, transitionsFor('Cart', states), []);
    const history = model.stores.get('Cart')!;
    expect(jumpTargets(history)).toEqual([1, 2, 3]);
    expect(canJump(history, 0)).toBe(false);
  });
});

describe('timeline filter', () => {
  const subject = (actionName: string, storeName = 'Cart', source = 'action' as const) => ({
    actionName,
    storeName,
    source,
  });

  it('matches globs against Store/action and excludes negated terms', () => {
    const terms = parseFilter('cart/* -scroll');
    expect(matchesFilter(terms, subject('addItem'))).toBe(true);
    expect(matchesFilter(terms, subject('onScroll'))).toBe(false);
    expect(matchesFilter(terms, subject('addItem', 'Auth'))).toBe(false);
  });

  it('matches substrings and source/store fields', () => {
    expect(matchesFilter(parseFilter('item'), subject('addItem'))).toBe(true);
    expect(matchesFilter(parseFilter('source:async'), subject('fetchUser'))).toBe(false);
    expect(matchesFilter(parseFilter('-source:hydrate store:car'), subject('x'))).toBe(true);
  });
});
