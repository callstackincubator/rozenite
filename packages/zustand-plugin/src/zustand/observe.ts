import { ensureBridge } from '../runtime/bridge';
import { registerStore, type RawAction, type StoreController } from '../runtime/store-registry';
import {
  findAction,
  listActions,
  persistInfoOf,
  runPersistCommand,
  withLiveActions,
  type PersistApi,
  type RozeniteOptions,
} from './middleware';

export type ObserveStoreOptions = RozeniteOptions;

/** What `observeStore` needs of a store: any Zustand store, bound hook or vanilla. */
export type ObservableStore = {
  getState(): unknown;
  setState(partial: never, replace?: never): unknown;
  subscribe(listener: (state: unknown, prev: unknown) => void): () => void;
};

type AnyStore = {
  getState: () => unknown;
  setState: (partial: unknown, replace?: boolean) => unknown;
  subscribe: (listener: (state: unknown) => void) => () => void;
  persist?: PersistApi;
};

const TRACE_FRAMES = 25;

/** Each store's current observation, so observing it again replaces it instead of doubling it. */
const observations = new WeakMap<object, () => void>();

/**
 * Registers a store that is not wrapped in `rozenite()`. It gets everything
 * that does not need to see inside the store: timeline, diffs, time travel,
 * editing, calling actions, persist and agent tools. Without the middleware
 * there are no action names: a change is recorded as `observed`, unless the
 * panel or an agent made it.
 */
export const observeStoreImpl = (input: ObservableStore, options: ObserveStoreOptions) => {
  if (options.enabled === false) return () => undefined;
  const store = input as unknown as AnyStore;
  observations.get(store)?.();

  let controller: StoreController | null = null;
  /** While the panel writes: an edit's name, or `null` for a jump (applied, not recorded). */
  let panelWrite: { edit: string | null } | null = null;
  /** An action the panel or an agent is calling, for the changes it makes synchronously. */
  let invoking: RawAction | null = null;
  let hydrating = false;

  const actionFor = (): RawAction => {
    if (panelWrite?.edit) return { name: panelWrite.edit, source: 'edit' };
    if (invoking) return invoking;
    if (hydrating) return { name: 'persist/rehydrate', source: 'hydrate' };
    return { name: 'change', source: 'observed' };
  };

  const write = (state: unknown, edit: string | null) => {
    panelWrite = { edit };
    try {
      store.setState(withLiveActions(state, store.getState()), true);
    } finally {
      panelWrite = null;
    }
  };

  controller = registerStore({
    name: options.name,
    maxAge: options.maxAge,
    trace: options.trace,
    stateSanitizer: options.stateSanitizer,
    adapter: {
      getState: () => store.getState(),
      restoreState: (state) => write(state, null),
      editState: (state, reason) => write(state, reason),
      invokeAction: (path, args) => {
        invoking = { name: path, source: 'action', args };
        try {
          return findAction(store.getState(), path)?.(...args);
        } finally {
          invoking = null;
        }
      },
      persistCommand: async (command) => {
        await runPersistCommand(store.persist, command);
        controller?.updateDescriptor();
      },
      getPersistInfo: () => persistInfoOf(store.persist),
      getActions: () => listActions(store.getState()),
    },
  });

  // Named so its frames can be dropped from traces.
  const unsubscribe = store.subscribe(function rozeniteObserve(next) {
    if (!controller || panelWrite?.edit === null) return;
    const stack = options.trace && controller.isRecording() ? new Error().stack : undefined;
    controller.record({
      next,
      action: actionFor(),
      traceId: stack ? controller.captureTrace(trimStack(stack)) : undefined,
    });
  });

  const persistUnsubscribes: (() => void)[] = [];
  const persist = store.persist;
  if (persist) {
    hydrating = !persist.hasHydrated() && !persist.getOptions().skipHydration;
    persistUnsubscribes.push(
      persist.onHydrate(() => {
        hydrating = true;
      }),
      persist.onFinishHydration(() => {
        hydrating = false;
        controller?.updateDescriptor();
      }),
    );
  }

  ensureBridge();

  const dispose = () => {
    unsubscribe();
    persistUnsubscribes.forEach((fn) => fn());
    controller = null;
    if (observations.get(store) === dispose) observations.delete(store);
  };
  observations.set(store, dispose);
  return dispose;
};

/** Drops the frames of our listener and of the store's `setState` that called it. */
const trimStack = (stack: string) => {
  const lines = stack.split('\n');
  const ours = lines.findIndex((line) => line.includes('rozeniteObserve'));
  if (ours === -1) return lines.slice(0, TRACE_FRAMES + 1).join('\n');
  // Zustand's `setState` notifies listeners through a `forEach` callback.
  const near = lines.slice(ours + 1, ours + 5).findIndex((line) => line.includes('setState'));
  const rest = lines.slice(near === -1 ? ours + 1 : ours + 2 + near);
  return [lines[0], ...rest].slice(0, TRACE_FRAMES + 1).join('\n');
};
