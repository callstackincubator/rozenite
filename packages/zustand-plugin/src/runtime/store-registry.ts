import {
  DEFAULT_BUDGET,
  UNBOUNDED_BUDGET,
  decodeValue,
  encodeValue,
  readRawPath,
  type EncodedValue,
  type StatePath,
} from '../shared/codec';
import { diffStates, formatPath } from '../shared/patch';
import type {
  ActionDescriptor,
  HelloResult,
  Keyframe,
  PersistInfo,
  StoreDescriptor,
  StoreWarning,
  Transition,
  TransitionAction,
  TransitionSource,
  ZustandStoreEvent,
} from '../shared/protocol';

/**
 * Device core. The `rozenite()` middleware registers each store here and
 * reports transitions as raw `next` references. Nothing is serialised until a
 * panel says hello: before that the ring buffer only holds references, which
 * costs nearly nothing because Zustand state is immutable by convention.
 */

export type RawAction = {
  name: string;
  source: TransitionSource;
  args?: unknown[];
};

export type RawTransition = {
  seq: number;
  timestamp: number;
  prev: unknown;
  next: unknown;
  action: RawAction;
  replace?: boolean;
  durationMs?: number;
  traceId?: string;
  /** First transition after a jump: its patches start from the jumped-to state. */
  afterJump?: boolean;
};

export type StoreAdapter = {
  getState: () => unknown;
  /** Writes a recorded state back without recording it (time travel). */
  restoreState: (state: unknown) => void;
  /** Writes `state` and records it as an `edit` transition named `reason`. */
  editState: (state: unknown, reason: string) => void;
  /** Calls the action at a dot path listed by `getActions`. */
  invokeAction: (path: string, args: unknown[]) => unknown;
  persistCommand: (command: 'rehydrate' | 'clear') => Promise<void>;
  getPersistInfo: () => PersistInfo | undefined;
  getActions: () => ActionDescriptor[];
};

export type RegisterStoreOptions = {
  name: string;
  adapter: StoreAdapter;
  maxAge?: number;
  trace?: boolean;
  stateSanitizer?: (state: unknown) => unknown;
};

export type StoreController = {
  readonly storeId: string;
  /** Recording paused (state still changes; history does not). */
  readonly isRecording: () => boolean;
  record: (transition: Omit<RawTransition, 'seq' | 'timestamp' | 'prev'>) => void;
  updateDescriptor: () => void;
  warn: (warning: Omit<StoreWarning, 'storeId'>) => void;
  captureTrace: (stack: string) => string;
};

type StoreRecord = {
  storeId: string;
  options: RegisterStoreOptions;
  maxAge: number;
  generation: number;
  createdAt: number;
  /** State before the oldest transition still in the ring. */
  base: { seq: number; state: unknown };
  ring: RawTransition[];
  seq: number;
  recording: boolean;
  /** Replaced by a newer store of the same name (Fast Refresh or a clash). */
  superseded: boolean;
  /** State the next transition diffs against: the last recorded, or jumped to. */
  lastRecordedState: unknown;
  jumpedTo?: number;
  sinceKeyframe: number;
  controller: StoreController;
};

type Listener = (event: ZustandStoreEvent) => void;

const KEYFRAME_EVERY = 50;
const MAX_TRACES = 500;
const MAX_WARNINGS = 100;
const DEFAULT_MAX_AGE = 50;

const sessionId = Math.random().toString(36).slice(2);
const records = new Map<string, StoreRecord>();
const traces = new Map<string, string>();
const warnings: StoreWarning[] = [];
const warnedOnce = new Set<string>();
let listener: Listener | null = null;
let listenerSeenAt = 0;
let traceCounter = 0;

/**
 * How long the device keeps streaming without hearing from the panel. The
 * panel pings every 5 s, but a hidden DevTools window may be throttled to
 * one timer a minute, so this leaves room for that. A panel that comes back
 * after it expired learns so from `ping` and says hello again.
 */
export const PANEL_IDLE_MS = 120_000;

/** Batched outgoing transitions, flushed on a short timer. */
let pendingTransitions: Transition[] = [];
let pendingKeyframes: Keyframe[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const sanitizeState = (record: StoreRecord, state: unknown): unknown => {
  const sanitizer = record.options.stateSanitizer;
  if (!sanitizer) return state;
  try {
    return sanitizer(state);
  } catch (error) {
    warnOnce(record, 'sanitizer-failed', `State sanitizer failed: ${(error as Error).message}`);
    return state;
  }
};

/**
 * Encoded values in one snapshot or transition past which the store gets a
 * `large-state` warning. Nothing is capped: the per-container budget already
 * turns big containers into lazy placeholders. What it cannot see is an
 * object reached through many paths, which is encoded once per path, so a
 * graph of shared references can still add up to megabytes per update.
 */
export const LARGE_ENCODING_NODES = 50_000;

/** Values in an encoded tree, counting every container, key and leaf. */
const countNodes = (value: EncodedValue): number => {
  let count = 1;
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) count += countNodes(child);
  }
  return count;
};

const checkEncodedSize = (
  record: StoreRecord,
  encoded: readonly EncodedValue[],
  what: 'snapshot' | 'transition',
  seq: number,
) => {
  // Once per store: the size changes with every update, the advice does not.
  const key = `${record.storeId}:large-state`;
  if (warnedOnce.has(key)) return;
  const nodes = encoded.reduce<number>((sum, value) => sum + countNodes(value), 0);
  if (nodes <= LARGE_ENCODING_NODES) return;
  warnedOnce.add(key);
  const message =
    `The ${what} at #${seq} of "${record.storeId}" encoded to ${nodes.toLocaleString('en-US')} values ` +
    `(warning threshold ${LARGE_ENCODING_NODES.toLocaleString('en-US')}). Objects shared between several ` +
    `places in the state are sent once per place, which slows down the app and the panel.`;
  console.warn(`[Rozenite, zustand-plugin] ${message}`);
  pushWarning({
    storeId: record.storeId,
    code: 'large-state',
    message,
    fix: `rozenite(initializer, {\n  name: '${record.options.name}',\n  // Drop or summarise the large branch before it leaves the device.\n  stateSanitizer: (state) => ({ ...state, bigBranch: undefined }),\n})`,
  });
};

const encodeState = (record: StoreRecord, state: unknown, seq: number) => {
  const encoded = encodeValue(sanitizeState(record, state), { budget: DEFAULT_BUDGET, seq });
  checkEncodedSize(record, [encoded], 'snapshot', seq);
  return encoded;
};

const describe = (record: StoreRecord): StoreDescriptor => {
  const { options } = record;
  let persist: PersistInfo | undefined;
  let actions: ActionDescriptor[] = [];
  try {
    persist = options.adapter.getPersistInfo();
    actions = options.adapter.getActions();
  } catch {
    // The adapter reads live store internals; a broken store must not break the panel.
  }
  return {
    storeId: record.storeId,
    name: options.name,
    actions,
    persist,
    generation: record.generation,
    createdAt: record.createdAt,
    recording: record.recording,
    maxAge: record.maxAge,
    jumpedTo: record.jumpedTo,
  };
};

const encodeAction = (raw: RawAction, seq: number): TransitionAction => ({
  name: raw.name,
  source: raw.source,
  args: raw.args?.map((arg, index) =>
    encodeValue(arg, { budget: DEFAULT_BUDGET, seq, path: ['$args', index] }),
  ),
});

const encodeTransition = (record: StoreRecord, raw: RawTransition): Transition => {
  const patches = diffStates(sanitizeState(record, raw.prev), sanitizeState(record, raw.next), {
    budget: DEFAULT_BUDGET,
    seq: raw.seq,
  });
  checkEncodedSize(
    record,
    patches.flatMap((patch) => [
      ...('value' in patch ? [patch.value] : []),
      ...('old' in patch ? [patch.old] : []),
    ]),
    'transition',
    raw.seq,
  );
  return {
    storeId: record.storeId,
    seq: raw.seq,
    timestamp: raw.timestamp,
    action: encodeAction(raw.action, raw.seq),
    patches,
    replace: raw.replace,
    durationMs: raw.durationMs,
    traceId: raw.traceId,
  };
};

const flush = () => {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  const transitions = pendingTransitions;
  const keyframes = pendingKeyframes;
  pendingTransitions = [];
  pendingKeyframes = [];
  if (listener && (transitions.length > 0 || keyframes.length > 0)) {
    listener({ type: 'transitions', transitions, keyframes });
  }
};

const scheduleFlush = () => {
  if (!flushTimer) flushTimer = setTimeout(flush, 16);
};

const emit: Listener = (event) => {
  listener?.(event);
};

const pushWarning = (warning: StoreWarning) => {
  warnings.push(warning);
  if (warnings.length > MAX_WARNINGS) warnings.shift();
  emit({ type: 'warning', warning });
};

const warnOnce = (
  record: StoreRecord,
  code: StoreWarning['code'],
  message: string,
  fix?: string,
) => {
  const key = `${record.storeId}:${code}:${message}`;
  if (warnedOnce.has(key)) return;
  warnedOnce.add(key);
  pushWarning({ storeId: record.storeId, code, message, fix });
};

/** Whether this record is the live registration for its name (not replaced). */
const isCurrent = (record: StoreRecord) => records.get(record.storeId) === record;

const keyframeOf = (record: StoreRecord, raw: RawTransition): Keyframe => ({
  storeId: record.storeId,
  seq: raw.seq,
  state: encodeState(record, raw.next, raw.seq),
});

const createController = (record: StoreRecord): StoreController => ({
  storeId: record.storeId,
  isRecording: () => record.recording,
  record: (input) => {
    if (record.superseded) {
      warnOnce(
        record,
        'duplicate-name',
        `Two live stores are named "${record.options.name}". The newer one replaced the older in the panel; give each store its own name.`,
      );
      return;
    }
    if (!record.recording) return;

    record.seq += 1;
    const raw: RawTransition = {
      ...input,
      prev: record.lastRecordedState,
      seq: record.seq,
      timestamp: Date.now(),
      afterJump: record.jumpedTo !== undefined || undefined,
    };
    record.lastRecordedState = raw.next;
    record.jumpedTo = undefined;
    record.ring.push(raw);
    while (record.ring.length > record.maxAge) {
      const dropped = record.ring.shift();
      if (dropped) record.base = { seq: dropped.seq, state: dropped.next };
    }

    if (listener) {
      pendingTransitions.push(encodeTransition(record, raw));
      record.sinceKeyframe += 1;
      if (record.sinceKeyframe >= KEYFRAME_EVERY || raw.afterJump) {
        record.sinceKeyframe = 0;
        pendingKeyframes.push(keyframeOf(record, raw));
      }
      scheduleFlush();
    }
  },
  updateDescriptor: () => {
    // A replaced store shares the live one's id: its descriptor (actions,
    // persist info) would overwrite the live store's in the panel.
    if (isCurrent(record)) emit({ type: 'store-update', store: describe(record) });
  },
  warn: (warning) => warnOnce(record, warning.code, warning.message, warning.fix),
  captureTrace: (stack) => {
    traceCounter += 1;
    const traceId = `${sessionId}:${traceCounter}`;
    traces.set(traceId, stack);
    if (traces.size > MAX_TRACES) {
      const oldest = traces.keys().next().value;
      if (oldest) traces.delete(oldest);
    }
    return traceId;
  },
});

const baseKeyframe = (record: StoreRecord): Keyframe => ({
  storeId: record.storeId,
  seq: record.base.seq,
  state: encodeState(record, record.base.state, record.base.seq),
});

/**
 * Registers a store, or -- when a store with the same name is already
 * registered -- treats it as a Fast Refresh replacement: same id, same
 * history, a `reload` transition in between, and the old instance detached.
 */
export const registerStore = (options: RegisterStoreOptions): StoreController => {
  const storeId = options.name;
  const maxAge = Math.max(1, options.maxAge ?? DEFAULT_MAX_AGE);
  const state = options.adapter.getState();
  const existing = records.get(storeId);

  if (existing) {
    existing.superseded = true;
    const record: StoreRecord = {
      ...existing,
      options,
      maxAge,
      generation: existing.generation + 1,
      superseded: false,
      ring: existing.ring.slice(),
      controller: undefined as unknown as StoreController,
    };
    record.controller = createController(record);
    records.set(storeId, record);
    emit({ type: 'store-update', store: describe(record) });
    record.controller.record({ next: state, action: { name: '♻ reloaded', source: 'reload' } });
    return record.controller;
  }

  const record: StoreRecord = {
    storeId,
    options,
    maxAge,
    generation: 1,
    createdAt: Date.now(),
    base: { seq: 0, state },
    ring: [],
    seq: 0,
    recording: true,
    superseded: false,
    lastRecordedState: state,
    sinceKeyframe: 0,
    controller: undefined as unknown as StoreController,
  };
  record.controller = createController(record);
  records.set(storeId, record);

  if (listener) {
    emit({ type: 'store-upsert', store: describe(record), keyframe: baseKeyframe(record) });
  }

  return record.controller;
};

// ---------------------------------------------------------------------------
// Panel-facing operations (wired to RPC by ./bridge)
// ---------------------------------------------------------------------------

export const getSessionId = () => sessionId;

export const setEventListener = (next: Listener | null) => {
  listener = next;
  listenerSeenAt = Date.now();
};

/** The panel called in (any RPC, including the 5 s `ping`). */
export const notePanelActivity = () => {
  listenerSeenAt = Date.now();
};

export const isPanelListening = () => listener !== null;

/**
 * Stops streaming to a panel that has not called in for `PANEL_IDLE_MS`
 * (DevTools was closed): transitions are then only kept as references again,
 * with nothing diffed or encoded until the next hello.
 */
export const dropIdleListener = (at = Date.now()) => {
  if (!listener || at - listenerSeenAt <= PANEL_IDLE_MS) return;
  listener = null;
  pendingTransitions = [];
  pendingKeyframes = [];
};

export const hello = (): HelloResult => {
  const stores: StoreDescriptor[] = [];
  const keyframes: Keyframe[] = [];
  const transitions: Transition[] = [];

  for (const record of records.values()) {
    stores.push(describe(record));
    keyframes.push(baseKeyframe(record));
    for (const raw of record.ring) {
      transitions.push(encodeTransition(record, raw));
      if (raw.afterJump) keyframes.push(keyframeOf(record, raw));
    }
    record.sinceKeyframe = 0;
  }

  return { sessionId, stores, keyframes, transitions, warnings: warnings.slice() };
};

const requireRecord = (storeId: string): StoreRecord => {
  const record = records.get(storeId);
  if (!record) {
    throw new Error(`Unknown store "${storeId}"`);
  }
  return record;
};

export const getStoreAdapter = (storeId: string) => requireRecord(storeId).options.adapter;

/**
 * Calls a store action the panel or an agent named, with encoded arguments,
 * exactly as app code would. Only actions listed in the descriptor qualify.
 */
export const invokeStoreAction = async (
  storeId: string,
  actionPath: string,
  args: readonly EncodedValue[],
): Promise<unknown> => {
  const { adapter } = requireRecord(storeId).options;
  const known = adapter.getActions().map((action) => action.path);
  if (!known.includes(actionPath)) {
    throw new Error(
      `"${actionPath}" is not an action of "${storeId}"${known.length > 0 ? ` (one of: ${known.join(', ')})` : ''}.`,
    );
  }
  return adapter.invokeAction(actionPath, args.map(decodeValue));
};

/** Writes an encoded value at `path` (or removes it), recorded as an edit named `reason`. */
export const editStoreValue = (
  storeId: string,
  path: StatePath,
  value: EncodedValue,
  op: 'set' | 'remove' = 'set',
  reason = `edit ${formatPath(path)}`,
) => {
  const { adapter } = requireRecord(storeId).options;
  adapter.editState(setDeep(adapter.getState(), path, decodeValue(value), op), reason);
};

/** Immutable set/remove at a path, creating nothing that is not there. */
export const setDeep = (
  root: unknown,
  path: StatePath,
  value: unknown,
  op: 'set' | 'remove',
): unknown => {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  // Paths address Map entries as `[index, 0 | 1]` (key or value) and Set
  // items by index, matching `readRawPath`.
  // Anything else at a Map throws: a silent no-op would be reported applied.
  if (root instanceof Map) {
    const entries = [...root.entries()];
    const index = Number(head);
    if (!entries[index]) {
      throw new Error(`The Map has no entry ${String(head)}.`);
    }
    if (rest.length === 0) {
      if (op === 'remove') {
        entries.splice(index, 1);
      } else if (Array.isArray(value) && value.length === 2) {
        entries[index] = [value[0], value[1]];
      } else {
        throw new Error(
          'A whole Map entry is set as a [key, value] pair. To change only its value, add `.1` to the path.',
        );
      }
      return new Map(entries);
    }
    const [entryKey, entryValue] = entries[index];
    if (rest[0] === 1) {
      entries[index] = [entryKey, setDeep(entryValue, rest.slice(1), value, op)];
    } else if (rest[0] === 0 && rest.length === 1 && op === 'set') {
      entries[index] = [value, entryValue];
    } else {
      throw new Error(
        'A Map key can only be replaced whole (`.0` ends the path). Remove the entry to drop it.',
      );
    }
    return new Map(entries);
  }
  if (root instanceof Set) {
    const items = [...root.values()];
    const index = Number(head);
    if (rest.length === 0 && op === 'remove') {
      items.splice(index, 1);
    } else {
      items[index] = setDeep(items[index], rest, value, op);
    }
    return new Set(items);
  }
  if (Array.isArray(root)) {
    const copy = root.slice();
    if (rest.length === 0 && op === 'remove') {
      copy.splice(Number(head), 1);
    } else {
      copy[Number(head)] = setDeep(copy[Number(head)], rest, value, op);
    }
    return copy;
  }
  const source = root !== null && typeof root === 'object' ? (root as Record<string, unknown>) : {};
  const copy: Record<string, unknown> = Object.assign(
    Object.create(Object.getPrototypeOf(source) ?? Object.prototype),
    source,
  );
  if (rest.length === 0 && op === 'remove') {
    delete copy[String(head)];
  } else {
    copy[String(head)] = setDeep(source[String(head)], rest, value, op);
  }
  return copy;
};

export const setRecording = (storeId: string | undefined, recording: boolean) => {
  const targets = storeId ? [requireRecord(storeId)] : [...records.values()];
  for (const record of targets) {
    if (record.recording === recording) continue;
    record.recording = recording;
    if (recording) {
      // Catch up on whatever changed while paused so the patch chain the
      // panel holds stays consistent.
      const current = record.options.adapter.getState();
      if (current !== record.lastRecordedState) {
        record.controller.record({
          next: current,
          action: { name: '⏸ changes while paused', source: 'anonymous' },
        });
      }
    }
    record.controller.updateDescriptor();
  }
};

/** The unsanitized state after `seq`, while the device still holds it. */
const recordedStateAt = (record: StoreRecord, seq: number): { state: unknown } | undefined => {
  if (seq === record.base.seq) return { state: record.base.state };
  const entry = record.ring.find((item) => item.seq === seq);
  return entry ? { state: entry.next } : undefined;
};

/**
 * Time travel: writes the device's own copy of the state after `seq` back
 * into the store, unsanitized and with every value the panel never loaded.
 * The write is not a transition; the store reports where it was jumped to,
 * and the next transition diffs against the restored state.
 */
export const jumpTo = (storeId: string, seq: number) => {
  const record = requireRecord(storeId);
  const recorded = recordedStateAt(record, seq);
  if (!recorded) {
    throw new Error(
      `#${seq} of "${storeId}" is no longer held on the device, which keeps the last ${record.maxAge} transitions (maxAge).`,
    );
  }
  record.options.adapter.restoreState(recorded.state);
  record.lastRecordedState = record.options.adapter.getState();
  record.jumpedTo = seq === record.seq ? undefined : seq;
  // Transitions recorded before the jump reach the panel before it hears
  // where the store now is.
  flush();
  record.controller.updateDescriptor();
};

export const getLazyValue = (storeId: string, seq: number, path: StatePath) => {
  const record = requireRecord(storeId);
  let node: unknown;
  if (path[0] === '$args') {
    // Action arguments: served exactly as the timeline encoded them.
    const entry = record.ring.find((item) => item.seq === seq);
    if (!entry) return { value: null, evicted: true };
    node = readRawPath(entry.action.args, path.slice(1));
  } else {
    const recorded = recordedStateAt(record, seq);
    if (!recorded) return { value: null, evicted: true };
    node = readRawPath(sanitizeState(record, recorded.state), path);
  }
  return { value: encodeValue(node, { budget: UNBOUNDED_BUDGET, seq, path }), evicted: false };
};

export const getRawTrace = (traceId: string) => traces.get(traceId) ?? null;

/** Test-only: forget every store. */
export const __resetRegistry = () => {
  records.clear();
  traces.clear();
  warnings.length = 0;
  warnedOnce.clear();
  pendingTransitions = [];
  pendingKeyframes = [];
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  listener = null;
  listenerSeenAt = 0;
};

// ---------------------------------------------------------------------------
// Device-side reads for agent tools
// ---------------------------------------------------------------------------

export type StoreInspection = {
  descriptor: StoreDescriptor;
  ring: readonly RawTransition[];
  base: { seq: number; state: unknown };
};

export const listStoreIds = (): string[] => [...records.keys()];

/** Live state after the store's `stateSanitizer`: what may leave the device. */
export const getSanitizedState = (storeId: string): unknown => {
  const record = requireRecord(storeId);
  return sanitizeState(record, record.options.adapter.getState());
};

export const inspectStore = (storeId: string): StoreInspection => {
  const record = requireRecord(storeId);
  return { descriptor: describe(record), ring: record.ring, base: record.base };
};

/** Patches of one recorded transition, encoded for an agent. */
export const encodeRawTransition = (storeId: string, raw: RawTransition): Transition =>
  encodeTransition(requireRecord(storeId), raw);
