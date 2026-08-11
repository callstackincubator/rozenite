import {
  isValueOfType,
  type FeatureFlag,
  type FeatureFlagsProvider,
  type FeatureFlagType,
  type FeatureFlagValue,
} from '../../shared/types';

/**
 * Structural counterpart of `DynamicConfig`/`Experiment` from
 * `@statsig/client-core`. Confirmed against the `@statsig/js-client` source
 * (`packages/js-client/src/StatsigClient.ts`, `getDynamicConfig`) — `.value`
 * is the config's full parameter map and `.get(paramName, defaultValue)` is
 * a typed accessor into it.
 */
export type StatsigDynamicConfigLike = {
  value: Record<string, unknown>;
  get<T>(paramName: string, defaultValue: T): T;
};

/**
 * The minimal structural interface this adapter needs from a Statsig
 * client. Deliberately permissive (index signature) so a real
 * `StatsigClient` — which has many more methods (`updateUserAsync`,
 * `flush`, `shutdown`, ...) — structurally satisfies it without us
 * depending on `@statsig/js-client` / `@statsig/react-native-bindings`.
 *
 * Confirmed from `@statsig/js-client` source
 * (statsig-io/js-client-monorepo, packages/js-client/src/StatsigClient.ts):
 * `checkGate(name, options?): boolean` and
 * `getDynamicConfig(name, options?): DynamicConfig` are both real,
 * documented methods. The `values_updated` event (used by `subscribe`) is
 * confirmed from `packages/client-core/src/StatsigClientEventEmitter.ts` —
 * it fires "when the Statsig client's internal values change as the result
 * of an initialize/update operation" (i.e. new data from the network), not
 * on local overrides, which never touch the store.
 */
export type StatsigClientLike = {
  checkGate(gateName: string, options?: unknown): boolean;
  getDynamicConfig(configName: string, options?: unknown): StatsigDynamicConfigLike;
  on?(eventName: string, callback: (...args: any[]) => void): void;
  off?(eventName: string, callback: (...args: any[]) => void): void;
  [key: string]: any;
};

/**
 * Shape of `LocalOverrideAdapter#getAllOverrides()`. Confirmed verbatim
 * from `@statsig/js-local-overrides` source
 * (statsig-io/js-client-monorepo, packages/js-local-overrides/src/LocalOverrideAdapter.ts).
 * `experiment`/`layer`/`paramStore` exist on the real type but are unused
 * here — this adapter only maps declared flags to gates or dynamic
 * configs (see `CreateStatsigFlagsAdapterOptions.flags` doc).
 */
export type StatsigOverrideStoreLike = {
  gate: Record<string, boolean>;
  dynamicConfig: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

/**
 * Minimal structural interface for `LocalOverrideAdapter` from
 * `@statsig/js-local-overrides`. Method names and signatures are confirmed
 * verbatim from source (see `StatsigOverrideStoreLike` doc for the repo
 * path) — `overrideGate`/`removeGateOverride` operate on gates,
 * `overrideDynamicConfig`/`removeDynamicConfigOverride` operate on dynamic
 * configs (and, by the same shape, experiments — this adapter only wires
 * the dynamic config pair, see below), and `getAllOverrides`/
 * `removeAllOverrides` cover the whole store.
 */
export type StatsigOverrideAdapterLike = {
  overrideGate(name: string, value: boolean): void;
  removeGateOverride(name: string): void;
  overrideDynamicConfig(name: string, value: Record<string, unknown>): void;
  removeDynamicConfigOverride(name: string): void;
  getAllOverrides(): StatsigOverrideStoreLike;
  removeAllOverrides(): void;
  [key: string]: any;
};

export type StatsigFlagDeclaration = {
  key: string;
  /** Defaults to 'boolean' (a gate). */
  type?: FeatureFlagType;
};

export type CreateStatsigFlagsAdapterOptions = {
  client: StatsigClientLike;
  overrideAdapter: StatsigOverrideAdapterLike;
  flags: StatsigFlagDeclaration[];
  /** Defaults to 'statsig'. */
  id?: string;
  /** Defaults to 'Statsig'. */
  name?: string;
};

/**
 * Dynamic configs (and experiments) are Statsig's only non-gate primitive,
 * and their value is a parameter map (`Record<string, unknown>`), not a
 * single scalar — there's no SDK-defined way to read "the" value of a
 * dynamic config as a lone string/number. Rather than guess at the user's
 * console schema, non-`json` flags read/write a single parameter named
 * `value` within the config by convention (`config.get('value', default)`
 * / `overrideDynamicConfig(key, { value })`). This is a convention chosen
 * by this adapter, not part of the Statsig API — a `json`-typed flag reads
 * and writes the config's full parameter map instead and avoids the
 * convention entirely.
 */
const DYNAMIC_CONFIG_VALUE_PARAM = 'value';

const DEFAULT_VALUE_BY_TYPE: Record<Exclude<FeatureFlagType, 'json'>, FeatureFlagValue> = {
  boolean: false,
  string: '',
  number: 0,
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireOverrideAdapterMethod = (
  overrideAdapter: StatsigOverrideAdapterLike,
  methodName: keyof StatsigOverrideAdapterLike,
): void => {
  if (typeof overrideAdapter[methodName] !== 'function') {
    throw new Error(
      `[Rozenite] Feature Flags Plugin: the Statsig override adapter is missing ` +
        `"${String(methodName)}". Pass a \`LocalOverrideAdapter\` instance from ` +
        `"@statsig/js-local-overrides" as \`overrideAdapter\`.`,
    );
  }
};

const requireClientMethod = (
  client: StatsigClientLike,
  methodName: keyof StatsigClientLike,
): void => {
  if (typeof client[methodName] !== 'function') {
    throw new Error(
      `[Rozenite] Feature Flags Plugin: the Statsig client is missing "${String(methodName)}". ` +
        `Pass a real \`StatsigClient\` instance as \`client\`.`,
    );
  }
};

export const createStatsigFlagsAdapter = (
  options: CreateStatsigFlagsAdapterOptions,
): FeatureFlagsProvider => {
  const { client, overrideAdapter, flags } = options;
  const declarationByKey = new Map<string, StatsigFlagDeclaration>(
    flags.map((flag) => [flag.key, flag]),
  );

  const resolveType = (declaration: StatsigFlagDeclaration): FeatureFlagType =>
    declaration.type ?? 'boolean';

  const requireDeclaration = (key: string): StatsigFlagDeclaration => {
    const declaration = declarationByKey.get(key);

    if (!declaration) {
      throw new Error(
        `[Rozenite] Feature Flags Plugin: Statsig adapter has no flag declared with key "${key}". ` +
          `Declare it in \`createStatsigFlagsAdapter({ flags: [...] })\`.`,
      );
    }

    return declaration;
  };

  const evaluate = (declaration: StatsigFlagDeclaration): FeatureFlagValue => {
    const type = resolveType(declaration);

    if (type === 'boolean') {
      requireClientMethod(client, 'checkGate');
      return client.checkGate(declaration.key);
    }

    requireClientMethod(client, 'getDynamicConfig');
    const config = client.getDynamicConfig(declaration.key);

    if (type === 'json') {
      // `StatsigDynamicConfigLike#value` is `Record<string, unknown>` per
      // the real SDK; it's the caller's responsibility to only declare
      // `json`-typed flags whose config value is JSON-serializable.
      return config.value as FeatureFlagValue;
    }

    return config.get(DYNAMIC_CONFIG_VALUE_PARAM, DEFAULT_VALUE_BY_TYPE[type]);
  };

  const provider: FeatureFlagsProvider = {
    id: options.id ?? 'statsig',
    name: options.name ?? 'Statsig',
    listFlags: (): FeatureFlag[] => {
      requireOverrideAdapterMethod(overrideAdapter, 'getAllOverrides');
      const currentOverrides = overrideAdapter.getAllOverrides();

      return flags.map((declaration) => {
        const type = resolveType(declaration);
        const overridden =
          type === 'boolean'
            ? declaration.key in currentOverrides.gate
            : declaration.key in currentOverrides.dynamicConfig;

        return {
          key: declaration.key,
          type,
          value: evaluate(declaration),
          overridden,
        };
      });
    },
    setOverride: (key, value) => {
      const declaration = requireDeclaration(key);
      const type = resolveType(declaration);

      if (!isValueOfType(type, value)) {
        throw new Error(
          `[Rozenite] Feature Flags Plugin: Statsig adapter cannot set override for "${key}" — ` +
            `expected a value of type "${type}".`,
        );
      }

      if (type === 'boolean') {
        requireOverrideAdapterMethod(overrideAdapter, 'overrideGate');
        overrideAdapter.overrideGate(key, value as boolean);
        return;
      }

      if (type === 'json') {
        if (!isPlainObject(value)) {
          throw new Error(
            `[Rozenite] Feature Flags Plugin: Statsig adapter cannot set a "json" override for "${key}" — ` +
              `Statsig dynamic config overrides must be a plain object (its full parameter map), ` +
              `not ${Array.isArray(value) ? 'an array' : typeof value}.`,
          );
        }

        requireOverrideAdapterMethod(overrideAdapter, 'overrideDynamicConfig');
        overrideAdapter.overrideDynamicConfig(key, value);
        return;
      }

      requireOverrideAdapterMethod(overrideAdapter, 'overrideDynamicConfig');
      overrideAdapter.overrideDynamicConfig(key, { [DYNAMIC_CONFIG_VALUE_PARAM]: value });
    },
    clearOverride: (key) => {
      const declaration = requireDeclaration(key);
      const type = resolveType(declaration);

      if (type === 'boolean') {
        requireOverrideAdapterMethod(overrideAdapter, 'removeGateOverride');
        overrideAdapter.removeGateOverride(key);
        return;
      }

      requireOverrideAdapterMethod(overrideAdapter, 'removeDynamicConfigOverride');
      overrideAdapter.removeDynamicConfigOverride(key);
    },
    clearAllOverrides: () => {
      requireOverrideAdapterMethod(overrideAdapter, 'removeAllOverrides');
      overrideAdapter.removeAllOverrides();
    },
    // `refresh` is intentionally omitted: `updateUserAsync`/`updateUserSync`
    // exist on the real SDK but re-identify the user rather than just
    // refetching config specs for the current one, and inventing a
    // no-op-user refresh convention here would be exactly the kind of
    // unconfirmed guess this adapter avoids elsewhere.
    subscribe: client.on
      ? (callback) => {
          // `values_updated` is confirmed (see `StatsigClientLike` doc) to
          // fire on initialize/update from the network. It does not fire on
          // local overrides — those repaint the panel via the RPC
          // mutation's returned flag instead, per the design doc.
          client.on?.('values_updated', callback);

          return {
            remove: () => {
              client.off?.('values_updated', callback);
            },
          };
        }
      : undefined,
  };

  return provider;
};
