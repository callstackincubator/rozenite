import { encodedEqual, type EncodedValue } from '../../shared/codec';
import { applyPatches } from '../../shared/patch';
import type {
  Keyframe,
  StoreDescriptor,
  Transition,
  ZustandHistoryExport,
} from '../../shared/protocol';

/**
 * Panel-side history, kept pure so it can be unit tested without React.
 *
 * Per store: a `base` state (the state before the first entry still held),
 * the transitions after it in seq order, and device keyframes that act as
 * authoritative anchors. Any state in history is rebuilt as base + patches;
 * reconstructed states are cached by seq every `CHECKPOINT_EVERY` entries in
 * a cache that lives as long as the base does.
 */

const DEFAULT_MAX_HISTORY = 1000;
const CHECKPOINT_EVERY = 25;

export type StoreHistory = {
  storeId: string;
  descriptor: StoreDescriptor;
  /** State before `entries[0]`. */
  base: { seq: number; state: EncodedValue };
  entries: Transition[];
  /** Device keyframes: authoritative state after a seq. */
  anchors: Map<number, EncodedValue>;
  lastUpdated: number;
  /** Shared, mutable memo of reconstructed states by seq. */
  cache: Map<number, EncodedValue>;
};

export type HistoryModel = {
  sessionId: string | null;
  stores: ReadonlyMap<string, StoreHistory>;
  maxHistory: number;
};

export const createModel = (maxHistory = DEFAULT_MAX_HISTORY): HistoryModel => ({
  sessionId: null,
  stores: new Map(),
  maxHistory,
});

const withStore = (model: HistoryModel, history: StoreHistory): HistoryModel => {
  const stores = new Map(model.stores);
  stores.set(history.storeId, history);
  return { ...model, stores };
};

const createStoreHistory = (descriptor: StoreDescriptor, keyframe: Keyframe): StoreHistory => ({
  storeId: descriptor.storeId,
  descriptor,
  base: { seq: keyframe.seq, state: keyframe.state },
  entries: [],
  anchors: new Map(),
  lastUpdated: descriptor.createdAt,
  cache: new Map(),
});

export const lastSeq = (history: StoreHistory): number =>
  history.entries.length > 0 ? history.entries[history.entries.length - 1].seq : history.base.seq;

// ---------------------------------------------------------------------------
// Reconstruction
// ---------------------------------------------------------------------------

/** State after `entries[index]` (index -1 is the base): what the device had at that point. */
export const stateAt = (history: StoreHistory, index: number): EncodedValue => {
  if (index < 0 || history.entries.length === 0) {
    return history.base.state;
  }
  const target = Math.min(index, history.entries.length - 1);
  const targetSeq = history.entries[target].seq;
  const cached = history.cache.get(targetSeq) ?? history.anchors.get(targetSeq);
  if (cached !== undefined) return cached;

  // Walk back to the nearest known state.
  let start = target;
  let state: EncodedValue | undefined;
  while (start >= 0) {
    const seq = history.entries[start].seq;
    state = history.cache.get(seq) ?? history.anchors.get(seq);
    if (state !== undefined) break;
    start -= 1;
  }
  if (state === undefined) {
    state = history.base.state;
  }

  for (let i = start + 1; i <= target; i += 1) {
    const entry = history.entries[i];
    state = history.anchors.get(entry.seq) ?? applyPatches(state, entry.patches, entry.seq);
    if ((i + 1) % CHECKPOINT_EVERY === 0 || i === target) {
      history.cache.set(entry.seq, state);
    }
  }
  return state;
};

export const latestState = (history: StoreHistory): EncodedValue =>
  stateAt(history, history.entries.length - 1);

export const indexOfSeq = (history: StoreHistory, seq: number): number => {
  // Entries are sorted by seq: binary search.
  let low = 0;
  let high = history.entries.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const value = history.entries[mid].seq;
    if (value === seq) return mid;
    if (value < seq) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
};

/** The state after `seq`: the base's, or an entry's. */
const stateAtSeq = (history: StoreHistory, seq: number): EncodedValue | undefined => {
  if (seq === history.base.seq) return history.base.state;
  const index = indexOfSeq(history, seq);
  return index < 0 ? undefined : stateAt(history, index);
};

/** What the store holds now: the state it was jumped to, or the latest. */
export const currentState = (history: StoreHistory): EncodedValue => {
  const { jumpedTo } = history.descriptor;
  const jumped = jumpedTo === undefined ? undefined : stateAtSeq(history, jumpedTo);
  return jumped === undefined ? latestState(history) : jumped;
};

/**
 * Whether the device can still jump to the state after `seq`: it keeps the
 * last `maxAge` transitions and the state before the oldest of them.
 */
export const canJump = (history: StoreHistory, seq: number): boolean =>
  seq >= history.base.seq && seq >= lastSeq(history) - history.descriptor.maxAge;

/** The seqs the store can be jumped to, oldest first. */
export const jumpTargets = (history: StoreHistory): number[] =>
  [history.base.seq, ...history.entries.map((entry) => entry.seq)].filter((seq) =>
    canJump(history, seq),
  );

// ---------------------------------------------------------------------------
// Updates from the device
// ---------------------------------------------------------------------------

const trim = (history: StoreHistory, maxHistory: number): StoreHistory => {
  const excess = history.entries.length - maxHistory;
  if (excess <= 0) return history;
  const newBaseState = stateAt(history, excess - 1);
  const newBaseSeq = history.entries[excess - 1].seq;
  return {
    ...history,
    base: { seq: newBaseSeq, state: newBaseState },
    entries: history.entries.slice(excess),
    anchors: new Map([...history.anchors].filter(([seq]) => seq > newBaseSeq)),
    cache: new Map([...history.cache].filter(([seq]) => seq > newBaseSeq)),
  };
};

/** Applies a `hello` result: replaces everything when the device session changed. */
export const applyHello = (
  model: HistoryModel,
  hello: {
    sessionId: string;
    stores: StoreDescriptor[];
    keyframes: Keyframe[];
    transitions: Transition[];
  },
): HistoryModel => {
  let next: HistoryModel =
    model.sessionId === hello.sessionId
      ? model
      : { ...createModel(model.maxHistory), sessionId: hello.sessionId };
  for (const store of hello.stores) {
    // The store's base keyframe is the first of its keyframes.
    const keyframe = hello.keyframes.find((frame) => frame.storeId === store.storeId);
    if (keyframe) {
      next = upsertStore(next, store, keyframe);
    }
  }
  next = applyTransitions(next, hello.transitions, hello.keyframes);
  // The replayed transitions all happened before any jump the device reports.
  return hello.stores.reduce(updateDescriptor, next);
};

/**
 * A store appeared or re-registered. For a store we already hold, a keyframe
 * newer than our last seq means we missed its re-creation: insert a reload
 * boundary leading to it.
 */
export const upsertStore = (
  model: HistoryModel,
  descriptor: StoreDescriptor,
  keyframe: Keyframe,
): HistoryModel => {
  const existing = model.stores.get(descriptor.storeId);
  if (!existing) {
    return withStore(model, createStoreHistory(descriptor, keyframe));
  }
  const last = lastSeq(existing);
  if (keyframe.seq <= last) {
    // Same store, nothing new (or a `hello` replay): refresh metadata only.
    return withStore(model, { ...existing, descriptor });
  }
  const current = latestState(existing);
  const boundary: Transition = {
    storeId: descriptor.storeId,
    seq: keyframe.seq,
    // Device clock, like every other entry, so "All stores" orders it right.
    timestamp: descriptor.createdAt,
    action: { name: '♻ reloaded', source: 'reload' },
    patches: encodedEqual(current, keyframe.state)
      ? []
      : [{ op: 'replace', path: [], value: keyframe.state, old: current }],
  };
  const anchors = new Map(existing.anchors);
  anchors.set(keyframe.seq, keyframe.state);
  return withStore(
    model,
    trim(
      {
        ...existing,
        descriptor,
        entries: [...existing.entries, boundary],
        anchors,
        lastUpdated: boundary.timestamp,
      },
      model.maxHistory,
    ),
  );
};

export const updateDescriptor = (
  model: HistoryModel,
  descriptor: StoreDescriptor,
): HistoryModel => {
  const existing = model.stores.get(descriptor.storeId);
  if (!existing) return model;
  return withStore(model, { ...existing, descriptor });
};

/**
 * Appends transitions (deduplicated by seq) and applies keyframes as anchors.
 * A new transition means the app changed the state again, so it ends any jump.
 */
export const applyTransitions = (
  model: HistoryModel,
  transitions: readonly Transition[],
  keyframes: readonly Keyframe[],
): HistoryModel => {
  const touched = new Map<string, StoreHistory>();
  const get = (storeId: string) => touched.get(storeId) ?? model.stores.get(storeId);

  for (const transition of transitions) {
    const history = get(transition.storeId);
    if (!history) continue;
    if (transition.seq <= lastSeq(history)) {
      // Duplicate (a `hello` replay overlapping live events) or out of order.
      if (indexOfSeq(history, transition.seq) >= 0 || transition.seq <= history.base.seq) continue;
      const entries = [...history.entries, transition].sort((a, b) => a.seq - b.seq);
      touched.set(history.storeId, { ...history, entries, cache: new Map() });
      continue;
    }
    touched.set(history.storeId, {
      ...history,
      descriptor: { ...history.descriptor, jumpedTo: undefined },
      entries: [...history.entries, transition],
      lastUpdated: transition.timestamp,
    });
  }

  for (const keyframe of keyframes) {
    const history = get(keyframe.storeId);
    if (!history || indexOfSeq(history, keyframe.seq) < 0) continue;
    const anchors = new Map(history.anchors);
    anchors.set(keyframe.seq, keyframe.state);
    touched.set(history.storeId, {
      ...history,
      anchors,
      // States cached from here on may have been derived from a wrong base.
      cache: new Map([...history.cache].filter(([seq]) => seq < keyframe.seq)),
    });
  }

  if (touched.size === 0) return model;
  const stores = new Map(model.stores);
  for (const [storeId, history] of touched) {
    stores.set(storeId, trim(history, model.maxHistory));
  }
  return { ...model, stores };
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const exportHistory = (
  model: HistoryModel,
  storeIds?: readonly string[],
): ZustandHistoryExport => ({
  format: 'rozenite-zustand-history',
  version: 1,
  exportedAt: new Date().toISOString(),
  stores: [...model.stores.values()]
    .filter((history) => !storeIds || storeIds.includes(history.storeId))
    .map((history) => ({
      store: { storeId: history.storeId, name: history.descriptor.name },
      base: { storeId: history.storeId, seq: history.base.seq, state: history.base.state },
      keyframes: [...history.anchors].map(([seq, state]) => ({
        storeId: history.storeId,
        seq,
        state,
      })),
      transitions: history.entries,
    })),
});

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export type TimelineEntry = {
  storeId: string;
  storeName: string;
  index: number;
  transition: Transition;
};

/** Entries of one store, or of every store merged by time ("All stores"). */
export const timelineEntries = (model: HistoryModel, storeId: string | null): TimelineEntry[] => {
  const histories = storeId
    ? [model.stores.get(storeId)].filter((history): history is StoreHistory => !!history)
    : [...model.stores.values()];
  const out: TimelineEntry[] = [];
  for (const history of histories) {
    history.entries.forEach((transition, index) => {
      out.push({ storeId: history.storeId, storeName: history.descriptor.name, index, transition });
    });
  }
  if (!storeId) {
    out.sort(
      (a, b) =>
        a.transition.timestamp - b.transition.timestamp ||
        a.storeId.localeCompare(b.storeId) ||
        a.transition.seq - b.transition.seq,
    );
  }
  return out;
};
