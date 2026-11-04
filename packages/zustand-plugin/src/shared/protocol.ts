import type { EncodedValue, StatePath } from './codec';
import type { StatePatch } from './patch';

export const ZUSTAND_PLUGIN_ID = '@rozenite/zustand-plugin';

export type ActionDescriptor = {
  /** Dot path of the function inside the state, e.g. `addItem` or `cart.add`. */
  path: string;
  name: string;
  arity: number;
};

export type PersistInfo = {
  storageKey: string;
  version: number | undefined;
  hasHydrated: boolean;
};

export type StoreDescriptor = {
  /** The store's `name`, which is also its id. */
  storeId: string;
  name: string;
  actions: ActionDescriptor[];
  persist?: PersistInfo;
  /** Increments every time the store is re-created by Fast Refresh. */
  generation: number;
  createdAt: number;
  recording: boolean;
  /**
   * Transitions the device keeps. Only the states after them, and the one
   * before the oldest, can be jumped to.
   */
  maxAge: number;
  /**
   * The seq the store was last jumped to, until the app changes its state
   * again. Jumps are not transitions: the next one carries a keyframe.
   */
  jumpedTo?: number;
};

export type TransitionSource =
  /** A function in the store, called synchronously. */
  | 'action'
  /** A `set` after an `await` inside the store's only pending async action. */
  | 'async'
  /** `set(state, replace, 'explicit/name')` */
  | 'named'
  /** `useStore.setState(...)` from outside the store. */
  | 'external'
  /** `set` with no attributable caller. */
  | 'anonymous'
  /** `persist` rehydration. */
  | 'hydrate'
  /** A value edited from the panel or by an agent. */
  | 'edit'
  /** Fast Refresh replaced the store. */
  | 'reload';

export type TransitionAction = {
  name: string;
  source: TransitionSource;
  /** Encoded call arguments of the action. */
  args?: EncodedValue[];
};

export type Transition = {
  storeId: string;
  seq: number;
  timestamp: number;
  action: TransitionAction;
  patches: StatePatch[];
  replace?: boolean;
  /** Time spent inside `set`, including listener notification. */
  durationMs?: number;
  /** Id for `getTrace`; present when tracing captured a stack. */
  traceId?: string;
};

export type Keyframe = {
  storeId: string;
  seq: number;
  state: EncodedValue;
};

export type StoreWarning = {
  storeId?: string;
  code: 'not-outermost' | 'duplicate-name' | 'sanitizer-failed' | 'large-state';
  message: string;
  /** Suggested code, shown with a copy button. */
  fix?: string;
};

// ---------------------------------------------------------------------------
// Device -> panel events
// ---------------------------------------------------------------------------

export type ZustandStoreEvent =
  /** Sent whenever the device bridge (re)connects, e.g. after an app reload. */
  | { type: 'device-ready'; sessionId: string }
  | { type: 'store-upsert'; store: StoreDescriptor; keyframe: Keyframe }
  | { type: 'store-update'; store: StoreDescriptor }
  | { type: 'transitions'; transitions: Transition[]; keyframes: Keyframe[] }
  | { type: 'warning'; warning: StoreWarning };

export type ZustandEventMap = {
  'zustand-event': ZustandStoreEvent;
};

// ---------------------------------------------------------------------------
// Panel -> device RPC
// ---------------------------------------------------------------------------

export type HelloResult = {
  sessionId: string;
  stores: StoreDescriptor[];
  /** The device ring buffer: oldest keyframe per store plus what followed. */
  keyframes: Keyframe[];
  transitions: Transition[];
  warnings: StoreWarning[];
};

export type ZustandMethods = {
  hello: () => Promise<HelloResult>;
  /**
   * Cheap liveness check; a changed `sessionId` means the app reloaded, and
   * `listening: false` that the device stopped streaming to an idle panel.
   * Either way the panel says hello again.
   */
  ping: () => Promise<{ sessionId: string; listening: boolean }>;
  /** Restores the device's own recorded copy of the state after `seq`. */
  jump: (params: { storeId: string; seq: number }) => Promise<void>;
  editPath: (params: {
    storeId: string;
    path: StatePath;
    value: EncodedValue;
    op?: 'set' | 'remove';
  }) => Promise<void>;
  invokeAction: (params: {
    storeId: string;
    actionPath: string;
    args: EncodedValue[];
  }) => Promise<{ result: EncodedValue }>;
  getLazyValue: (params: { storeId: string; seq: number; path: StatePath }) => Promise<{
    value: EncodedValue | null;
    evicted: boolean;
  }>;
  /** The raw stack captured for a transition; the panel symbolicates it. */
  getTrace: (params: { traceId: string }) => Promise<string | null>;
  setRecording: (params: { storeId?: string; recording: boolean }) => Promise<void>;
  persistCommand: (params: {
    storeId: string;
    command: 'rehydrate' | 'clear';
  }) => Promise<{ persist?: PersistInfo }>;
};

/** Export file format. */
export type ZustandHistoryExport = {
  format: 'rozenite-zustand-history';
  version: 1;
  exportedAt: string;
  stores: {
    store: Pick<StoreDescriptor, 'storeId' | 'name'>;
    base: Keyframe;
    /** Device keyframes: the state after a seq, for entries that follow a jump. */
    keyframes: Keyframe[];
    transitions: Transition[];
  }[];
};
