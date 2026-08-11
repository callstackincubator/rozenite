import {
  inferFlagType,
  type FeatureFlag,
  type FeatureFlagsProvider,
  type FeatureFlagValue,
} from '../../shared/types';
import { createFlagOverrides, type FlagOverrides } from '../overrides';

/**
 * Minimal structural shape LD's evaluation reasons carry. We don't depend on
 * the LD SDK, so this is intentionally loose rather than the SDK's full
 * `LDEvaluationReason` union.
 */
export type LDEvaluationReason = {
  kind: string;
  [key: string]: unknown;
};

/** Structural counterpart of LD's `LDEvaluationDetail<T>`. */
export type LDEvaluationDetailLike<TValue> = {
  value: TValue;
  variationIndex: number | null;
  reason: LDEvaluationReason;
};

export type LDFlagSet = Record<string, unknown>;

/**
 * The minimal structural interface the wrapper needs from an LD client.
 * Deliberately permissive (extra properties are allowed via the index
 * signature) so a real `ReactNativeLDClient` — which has many more methods
 * (`identify`, `track`, `close`, `flush`, `variation`, ...) — structurally
 * satisfies it without us depending on `@launchdarkly/react-native-client-sdk`.
 */
export type LDClientLike = {
  boolVariation(key: string, defaultValue: boolean): boolean;
  stringVariation(key: string, defaultValue: string): string;
  numberVariation(key: string, defaultValue: number): number;
  jsonVariation(key: string, defaultValue: unknown): unknown;
  boolVariationDetail(key: string, defaultValue: boolean): LDEvaluationDetailLike<boolean>;
  stringVariationDetail(key: string, defaultValue: string): LDEvaluationDetailLike<string>;
  numberVariationDetail(key: string, defaultValue: number): LDEvaluationDetailLike<number>;
  jsonVariationDetail(key: string, defaultValue: unknown): LDEvaluationDetailLike<unknown>;
  allFlags(): LDFlagSet;
  on(eventName: string, callback: (...args: any[]) => void, context?: unknown): void;
  off(eventName: string, callback: (...args: any[]) => void): void;
  [key: string]: any;
};

export type CreateLaunchDarklyFlagsAdapterOptions = {
  client: LDClientLike;
  /** Defaults to 'launchdarkly'. */
  id?: string;
  /** Defaults to 'LaunchDarkly'. */
  name?: string;
  /** Bring your own store to wire persistence; one is created if omitted. */
  overrides?: FlagOverrides;
};

export type LaunchDarklyFlagsAdapter = {
  provider: FeatureFlagsProvider;
  /** Pass this to `<LDProvider client={...}>` — the only changed line in the app. */
  client: LDClientLike;
};

const CHANGE_EVENT = 'change';

type VariationMethod = 'boolVariation' | 'stringVariation' | 'numberVariation' | 'jsonVariation';

const VARIATION_DETAIL_METHOD: Record<VariationMethod, string> = {
  boolVariation: 'boolVariationDetail',
  stringVariation: 'stringVariationDetail',
  numberVariation: 'numberVariationDetail',
  jsonVariation: 'jsonVariationDetail',
};

/**
 * Whether an override value is safe to hand back through a given variation
 * method. `jsonVariation`/`jsonVariationDetail` accept any JSON-serializable
 * value; the typed variations require the override to already be that type.
 *
 * A type-mismatched override (e.g. a string override read via
 * `boolVariation`) is *not* coerced or returned — we delegate to the raw
 * client instead. Returning a wrong-typed value would silently violate the
 * caller's assumed return type (LD's own hooks, e.g. `useBoolVariation`,
 * assume `boolVariation` returns a `boolean`), which is worse than the
 * override being briefly ineffective for that one call site.
 */
const matchesVariationType = (method: VariationMethod, value: FeatureFlagValue): boolean => {
  switch (method) {
    case 'boolVariation':
      return typeof value === 'boolean';
    case 'stringVariation':
      return typeof value === 'string';
    case 'numberVariation':
      return typeof value === 'number';
    case 'jsonVariation':
      return true;
    default:
      return false;
  }
};

/**
 * Reason attached to `*VariationDetail` results served from an override.
 * `kind` is deliberately not one of LD's own reason kinds (`OFF`,
 * `FALLTHROUGH`, `TARGET_MATCH`, `RULE_MATCH`, `PREREQUISITE_FAILED`,
 * `ERROR`) — none of those mean "DevTools forced this value", and reusing
 * one would misrepresent how the value was actually produced.
 */
const overrideReason = (): LDEvaluationReason => ({
  kind: 'DEVTOOLS_OVERRIDE',
});

const wrapClient = (rawClient: LDClientLike, overrides: FlagOverrides): LDClientLike => {
  // Listeners registered through the wrapper's `on('change', ...)`. Kept
  // separately from the raw client's own listener list so we can fan out a
  // synthetic `change` on every override mutation, in addition to whatever
  // real `change` events LD itself emits (those still reach the listener
  // directly, since `on` also registers it on the raw client below).
  const changeListeners = new Set<(...args: unknown[]) => void>();

  const emitSyntheticChange = () => {
    // Assumption about LD's `change` event: `setupListeners` in the LD SDK
    // does `client.on('change', () => setState({ client }))` — it only
    // cares that a `change` event fired, not what arguments it carries. A
    // real LD `change` event is documented to pass an object describing
    // which flags changed, but nothing that reads through the context
    // client depends on that payload for re-rendering. We therefore call
    // listeners with no arguments here; if a consumer's own `change`
    // listener inspects the payload, it won't see one from an
    // override-triggered synthetic event.
    for (const listener of changeListeners) {
      try {
        listener();
      } catch (error) {
        console.error('[Rozenite] Feature Flags Plugin: LaunchDarkly change listener threw', error);
      }
    }
  };

  overrides.subscribe(emitSyntheticChange);

  const makeVariation = (method: VariationMethod) => (key: string, defaultValue: unknown) => {
    if (overrides.has(key)) {
      const value = overrides.get(key) as FeatureFlagValue;
      if (matchesVariationType(method, value)) {
        return value;
      }
    }

    return (rawClient[method] as (key: string, defaultValue: unknown) => unknown)(
      key,
      defaultValue,
    );
  };

  const makeVariationDetail = (method: VariationMethod) => (key: string, defaultValue: unknown) => {
    if (overrides.has(key)) {
      const value = overrides.get(key) as FeatureFlagValue;
      if (matchesVariationType(method, value)) {
        return {
          value,
          variationIndex: null,
          reason: overrideReason(),
        };
      }
    }

    const detailMethod = VARIATION_DETAIL_METHOD[method];
    return (rawClient[detailMethod] as (key: string, defaultValue: unknown) => unknown)(
      key,
      defaultValue,
    );
  };

  const intercepted: Record<string, (...args: any[]) => unknown> = {
    boolVariation: makeVariation('boolVariation'),
    stringVariation: makeVariation('stringVariation'),
    numberVariation: makeVariation('numberVariation'),
    jsonVariation: makeVariation('jsonVariation'),
    boolVariationDetail: makeVariationDetail('boolVariation'),
    stringVariationDetail: makeVariationDetail('stringVariation'),
    numberVariationDetail: makeVariationDetail('numberVariation'),
    jsonVariationDetail: makeVariationDetail('jsonVariation'),
    allFlags: () => ({ ...rawClient.allFlags(), ...overrides.getAll() }),
    on: (eventName: string, callback: (...args: unknown[]) => void, context?: unknown) => {
      if (eventName === CHANGE_EVENT) {
        changeListeners.add(callback);
      }

      return rawClient.on(eventName, callback, context);
    },
    off: (eventName: string, callback: (...args: unknown[]) => void) => {
      if (eventName === CHANGE_EVENT) {
        changeListeners.delete(callback);
      }

      return rawClient.off(eventName, callback);
    },
  };

  return new Proxy(rawClient, {
    get(target, prop) {
      if (typeof prop === 'string' && prop in intercepted) {
        return intercepted[prop];
      }

      const value = Reflect.get(target, prop, target);
      // Everything else (`identify`, `track`, `close`, `flush`, ...) passes
      // straight through, bound to the raw client so `this` inside those
      // methods still refers to the real LD client instance, not the proxy.
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as LDClientLike;
};

export const createLaunchDarklyFlagsAdapter = (
  options: CreateLaunchDarklyFlagsAdapterOptions,
): LaunchDarklyFlagsAdapter => {
  const rawClient = options.client;
  const overrides = options.overrides ?? createFlagOverrides();

  const provider: FeatureFlagsProvider = {
    id: options.id ?? 'launchdarkly',
    name: options.name ?? 'LaunchDarkly',
    listFlags: (): FeatureFlag[] => {
      const raw = rawClient.allFlags();
      const overriddenValues = overrides.getAll();
      const keys = new Set([...Object.keys(raw), ...Object.keys(overriddenValues)]);

      return Array.from(keys).map((key) => {
        const hasOverride = overrides.has(key);
        const value = (hasOverride ? overriddenValues[key] : raw[key]) as FeatureFlagValue;

        return {
          key,
          type: inferFlagType(value),
          value,
          overridden: hasOverride,
        };
      });
    },
    setOverride: (key, value) => {
      overrides.set(key, value);
    },
    clearOverride: (key) => {
      overrides.clear(key);
    },
    clearAllOverrides: () => {
      overrides.clearAll();
    },
    // No `refresh` — `LDClientLike` has no documented, version-stable way to
    // force a refresh (LD refreshes over its own streaming/polling
    // connection), so we don't invent one.
    subscribe: (callback) => {
      const overridesSubscription = overrides.subscribe(callback);
      rawClient.on(CHANGE_EVENT, callback);

      return {
        remove: () => {
          overridesSubscription.remove();
          rawClient.off(CHANGE_EVENT, callback);
        },
      };
    },
  };

  return {
    provider,
    client: wrapClient(rawClient, overrides),
  };
};
