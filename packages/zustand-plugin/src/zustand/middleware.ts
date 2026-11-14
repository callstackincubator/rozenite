import { isPlainObject } from '../shared/codec';
import type { ActionDescriptor, PersistInfo } from '../shared/protocol';
import { ensureBridge } from '../runtime/bridge';
import {
  registerStore,
  type RawAction,
  type StoreAdapter,
  type StoreController,
} from '../runtime/store-registry';
import { callStack, now, type CallEntry } from './action-context';

export type RozeniteOptions = {
  /** Store name shown in the panel. Required: it is the store's stable id. */
  name: string;
  /** Defaults to true in development. */
  enabled?: boolean;
  /**
   * Transitions kept on the device for replay when the panel connects. Only
   * these can be jumped to. @default 50
   */
  maxAge?: number;
  /** Capture a stack for every transition, symbolicated through Metro in the panel. @default false */
  trace?: boolean;
  /** Applied to every state before it leaves the device. */
  stateSanitizer?: (state: unknown) => unknown;
};

type PersistApi = {
  clearStorage: () => void;
  rehydrate: () => Promise<void> | void;
  hasHydrated: () => boolean;
  onHydrate: (listener: (state: unknown) => void) => () => void;
  onFinishHydration: (listener: (state: unknown) => void) => () => void;
  getOptions: () => { name?: string; version?: number; skipHydration?: boolean };
};

type AnySet = (partial: unknown, replace?: boolean, action?: unknown) => unknown;
type AnyGet = () => unknown;
type AnyApi = {
  setState: AnySet;
  getState: AnyGet;
  persist?: PersistApi;
  [key: string | symbol]: unknown;
};
type AnyInitializer = (set: AnySet, get: AnyGet, api: AnyApi) => unknown;

const WRAPPED = Symbol.for('rozenite.zustand-plugin.wrapped');
const MAX_ACTION_DEPTH = 3;
const TRACE_FRAMES = 25;

/** The name and origin of a `setState` call that inner middleware relays to our `set` without them. */
type Stash = { name: unknown; origin: 'internal' | 'external' };

/** Native promises carry no API of their own, so chaining one loses nothing. */
const isNativePromise = (value: unknown): value is Promise<unknown> =>
  typeof Promise === 'function' &&
  value instanceof Promise &&
  Object.getPrototypeOf(value) === Promise.prototype;

type AnyFn = (...args: unknown[]) => unknown;

/**
 * Maps every function in `state` -- the store's actions, in plain objects up
 * to `MAX_ACTION_DEPTH` levels down -- through `visit`, copying only the
 * objects on the way to a function that changed.
 */
const mapActions = (
  state: unknown,
  visit: (fn: AnyFn, path: string[]) => unknown,
  path: string[] = [],
): unknown => {
  if (!isPlainObject(state) || path.length > MAX_ACTION_DEPTH) return state;
  let copy: Record<string, unknown> | null = null;
  for (const key of Object.keys(state)) {
    const value = state[key];
    const next =
      typeof value === 'function'
        ? visit(value as AnyFn, [...path, key])
        : mapActions(value, visit, [...path, key]);
    if (next !== value) {
      copy ??= { ...state };
      copy[key] = next;
    }
  }
  return copy ?? state;
};

/** `target` with `value` at `path`, through plain objects only. */
const assignAt = (target: unknown, path: string[], value: unknown): unknown => {
  if (!isPlainObject(target)) return target;
  const [key, ...rest] = path;
  const next = rest.length > 0 ? assignAt(target[key], rest, value) : value;
  return next === target[key] ? target : { ...target, [key]: next };
};

/**
 * `state` with every action replaced by the live store's own: a recorded
 * state holds the functions of its time (a store replaced by Fast Refresh
 * since), and a decoded one holds none.
 */
const withLiveActions = (state: unknown, live: unknown): unknown => {
  let out = state;
  mapActions(live, (fn, path) => {
    out = assignAt(out, path, fn);
    return fn;
  });
  return out;
};

const listActions = (state: unknown): ActionDescriptor[] => {
  const out: ActionDescriptor[] = [];
  mapActions(state, (fn, path) => {
    out.push({ path: path.join('.'), name: path[path.length - 1], arity: fn.length });
    return fn;
  });
  return out;
};

const trimStack = (stack: string) => {
  const lines = stack.split('\n');
  // Drop our own frames: Error, perform, and the set wrappers.
  return [
    lines[0],
    ...lines
      .slice(1)
      .filter((line) => !/\bperform\b|internalSet|externalSet|relayTo|rozeniteImpl/.test(line)),
  ]
    .slice(0, TRACE_FRAMES + 1)
    .join('\n');
};

/**
 * The untyped implementation behind `rozenite()`. See `../../zustand.ts` for
 * the typed, production-safe export.
 */
export const rozeniteImpl =
  (initializer: AnyInitializer, options: RozeniteOptions) =>
  (set: AnySet, get: AnyGet, api: AnyApi): unknown => {
    if (options.enabled === false) {
      return initializer(set, get, api);
    }

    let controller: StoreController | null = null;
    let initializing = true;
    /** While the panel writes: an edit's name, or `null` for a jump (applied, not recorded). */
    let panelWrite: { edit: string | null } | null = null;
    /** `set` calls in progress: one made by a listener folds into the outer transition. */
    let depth = 0;
    let stash: Stash | null = null;
    /** This store's async actions that have not settled yet. */
    const pending = new Set<CallEntry>();
    let watchedPersist: PersistApi | undefined;
    /** A `persist` hydration is in flight: its one replacing `set` is coming. */
    let hydrating = false;

    // The vanilla store assigns the initial state after the initializer
    // returns, so reads fall back to it until then (`initialState` is
    // declared below and only read after registration).
    const current = () => {
      const state = get();
      return state === undefined ? initialState : state;
    };
    const persistApi = () => api.persist;

    // ----- attribution -----------------------------------------------------

    const resolveAction = (
      nameOrAction: unknown,
      origin: Stash['origin'],
      replace: boolean | undefined,
    ): RawAction => {
      if (panelWrite?.edit) {
        return { name: panelWrite.edit, source: 'edit' };
      }
      const context = callStack[callStack.length - 1];

      if (nameOrAction !== undefined && nameOrAction !== null) {
        const isObject = typeof nameOrAction === 'object';
        const name = isObject
          ? String((nameOrAction as { type?: unknown }).type)
          : String(nameOrAction);
        let args = context?.args;
        if (isObject) {
          const payload = { ...(nameOrAction as Record<string, unknown>) };
          delete payload.type;
          if (Object.keys(payload).length > 0) args = [payload];
        }
        return { name, source: 'named', args };
      }

      if (context) {
        return {
          name:
            context.storeName === options.name
              ? context.name
              : `${context.storeName}.${context.name}`,
          source: 'action',
          args: context.args,
        };
      }

      if (origin === 'external') {
        return { name: 'setState', source: 'external' };
      }

      // `persist` hydrates with exactly one unnamed, replacing `set` through
      // the `set` we gave it (`perform` clears the flag when it sees it). A
      // failed hydration makes none, so the next such `set` takes its name.
      if (hydrating && replace) {
        return { name: 'persist/rehydrate', source: 'hydrate' };
      }

      // Only this store's own pending calls: a call pending in another store
      // did not necessarily cause this `set` (a timer or subscription in
      // this store may have).
      if (pending.size === 1) {
        const [only] = pending;
        return { name: only.name, source: 'async', args: only.args };
      }

      return { name: 'anonymous', source: 'anonymous' };
    };

    // ----- the instrumented set --------------------------------------------

    const perform = (
      partial: unknown,
      replace: boolean | undefined,
      nameOrAction: unknown,
      origin: Stash['origin'],
    ) => {
      // Taken first so that no later `set` (a listener's) inherits it.
      const relayed = stash;
      stash = null;
      if (initializing || !controller || depth > 0 || panelWrite?.edit === null) {
        return set(partial, replace);
      }

      const action = resolveAction(
        nameOrAction ?? relayed?.name,
        relayed?.origin ?? origin,
        replace,
      );
      if (action.source === 'hydrate') hydrating = false;
      const prev = get();
      const startedAt = now();
      const stack = options.trace && controller.isRecording() ? new Error().stack : undefined;
      let result: unknown;
      depth += 1;
      try {
        result = set(partial, replace);
      } finally {
        depth -= 1;
      }
      const next = get();
      if (!Object.is(prev, next)) {
        controller.record({
          next,
          action,
          replace: replace || undefined,
          durationMs: now() - startedAt,
          traceId: stack ? controller.captureTrace(trimStack(stack)) : undefined,
        });
      }
      return result;
    };

    const internalSet: AnySet = (partial, replace, nameOrAction) =>
      perform(partial, replace, nameOrAction, 'internal');

    const externalSet: AnySet = (partial, replace, nameOrAction) =>
      perform(partial, replace, nameOrAction, 'external');

    // Inner middleware such as `devtools()` and `persist()` replace
    // `api.setState` with a wrapper that calls our `set` without the third
    // argument, and hand that wrapper to the initializer as its `set`. While
    // the initializer runs, `api.setState` is an accessor: it keeps what they
    // assign and hands out a relay that stashes the name (and whether the call
    // came from inside the store) for `perform` to pick up. Afterwards it is a
    // plain property again, so `create()` copies it onto the hook.
    let innerSetState: AnySet | null = null;
    const relayTo =
      (target: AnySet, origin: Stash['origin']): AnySet =>
      (partial, replace, nameOrAction) => {
        const saved = stash;
        // Through several wrappers the outermost call knows best.
        stash = saved
          ? { name: saved.name ?? nameOrAction, origin: saved.origin }
          : { name: nameOrAction, origin };
        try {
          return target(partial, replace, nameOrAction);
        } finally {
          stash = saved;
        }
      };
    Object.defineProperty(api, 'setState', {
      configurable: true,
      enumerable: true,
      get: () => (innerSetState ? relayTo(innerSetState, 'internal') : externalSet),
      set: (value: AnySet) => {
        innerSetState = value;
      },
    });

    // ----- action wrapping ---------------------------------------------------

    const wrapFunction = (fn: AnyFn, path: string) => {
      if ((fn as { [WRAPPED]?: boolean })[WRAPPED]) return fn;
      const wrapped = function (this: unknown, ...args: unknown[]) {
        const entry: CallEntry = { storeName: options.name, name: path, args };
        callStack.push(entry);
        let result: unknown;
        try {
          result = fn.apply(this, args);
        } finally {
          callStack.pop();
        }

        // Any other thenable (a promise subclass, a cancellable request, a
        // query builder) goes back untouched: it may carry methods of its
        // own, and watching it settle would mean calling its `then`, which
        // runs some thenables again or marks a rejection as handled. Its
        // later `set`s are then anonymous rather than guessed.
        if (!isNativePromise(result)) {
          return result;
        }

        pending.add(entry);
        // Returned in place of the original so an unhandled rejection is
        // still reported exactly as before: through the caller's chain.
        return result.then(
          (value) => {
            pending.delete(entry);
            return value;
          },
          (error: unknown) => {
            pending.delete(entry);
            throw error;
          },
        );
      };
      Object.defineProperty(wrapped, 'name', { value: fn.name || path, configurable: true });
      Object.defineProperty(wrapped, 'length', { value: fn.length, configurable: true });
      Object.defineProperty(wrapped, WRAPPED, { value: true });
      return wrapped;
    };

    /** Resolves an action listed by `listActions`; the registry checks the path. */
    const actionAt = (path: string) =>
      path
        .split('.')
        .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], get()) as AnyFn;

    // ----- persist -----------------------------------------------------------

    const getPersistInfo = (): PersistInfo | undefined => {
      const persist = persistApi();
      if (!persist) return undefined;
      const { name, version } = persist.getOptions();
      return { storageKey: String(name ?? ''), version, hasHydrated: persist.hasHydrated() };
    };

    const watchPersist = () => {
      const persist = persistApi();
      if (!persist || persist === watchedPersist) return;
      watchedPersist = persist;
      // An async hydration started during the initializer is still in flight.
      hydrating = !persist.hasHydrated() && !persist.getOptions().skipHydration;
      persist.onHydrate(() => {
        hydrating = true;
      });
      persist.onFinishHydration(() => {
        hydrating = false;
        controller?.updateDescriptor();
      });
    };

    // ----- adapter -----------------------------------------------------------

    const write = (state: unknown, edit: string | null) => {
      panelWrite = { edit };
      try {
        // Through the store's own `setState`, not our raw `set`: inner
        // middleware such as `persist` wrap it to write storage.
        api.setState(withLiveActions(state, get()), true);
      } finally {
        panelWrite = null;
      }
    };

    const adapter: StoreAdapter = {
      getState: current,
      restoreState: (state) => write(state, null),
      editState: (state, reason) => write(state, reason),
      invokeAction: (path, args) => actionAt(path)(...args),
      persistCommand: async (command) => {
        const persist = persistApi();
        if (!persist) throw new Error('No persist middleware on this store.');
        if (command === 'rehydrate') {
          await persist.rehydrate();
        } else {
          persist.clearStorage();
        }
        controller?.updateDescriptor();
      },
      getPersistInfo,
      getActions: () => listActions(current()),
    };

    // ----- initialise ----------------------------------------------------------

    const initialState = mapActions(initializer(internalSet, get, api), (fn, path) =>
      wrapFunction(fn, path.join('.')),
    );

    // A plain property again, holding what the inner middleware left there.
    Object.defineProperty(api, 'setState', {
      value: innerSetState ? relayTo(innerSetState, 'external') : externalSet,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    initializing = false;

    controller = registerStore({
      name: options.name,
      adapter,
      maxAge: options.maxAge,
      trace: options.trace,
      stateSanitizer: options.stateSanitizer,
    });
    ensureBridge();
    watchPersist();

    // `persist` placed *outside* rozenite() assigns `api.persist` after this
    // initializer returns, and its hydration `set` never reaches us.
    const persistInside = !!persistApi();
    setTimeout(() => {
      if (persistInside || !persistApi()) return;
      controller?.warn({
        code: 'not-outermost',
        message: `rozenite() is not the outermost middleware of "${options.name}", so persist hydration is invisible to it.`,
        fix: `create(rozenite(persist(…), { name: '${options.name}' }))`,
      });
      watchPersist();
      controller?.updateDescriptor();
    }, 0);

    return initialState;
  };
