export type {
  FeatureFlag,
  FeatureFlagsProvider,
  FeatureFlagsSubscription,
  FeatureFlagType,
  FeatureFlagValue,
  JsonValue,
  MaybePromise,
} from './src/shared/types';

export type {
  CreateCustomFlagsAdapterOptions,
  CreateLaunchDarklyFlagsAdapterOptions,
  CreateStatsigFlagsAdapterOptions,
  FeatureFlagInput,
  LaunchDarklyFlagsAdapter,
  LDClientLike,
  LDEvaluationDetailLike,
  LDEvaluationReason,
  LDFlagSet,
  StatsigClientLike,
  StatsigDynamicConfigLike,
  StatsigFlagDeclaration,
  StatsigOverrideAdapterLike,
  StatsigOverrideStoreLike,
} from './src/react-native/adapters';

export type { FlagOverrides, FlagOverridesOptions } from './src/react-native/overrides';

export let createCustomFlagsAdapter: typeof import('./src/react-native/adapters').createCustomFlagsAdapter;
export let createLaunchDarklyFlagsAdapter: typeof import('./src/react-native/adapters').createLaunchDarklyFlagsAdapter;
export let createStatsigFlagsAdapter: typeof import('./src/react-native/adapters').createStatsigFlagsAdapter;
export let createFlagOverrides: typeof import('./src/react-native/overrides').createFlagOverrides;
export let useRozeniteFeatureFlagsPlugin: typeof import('./src/react-native/useRozeniteFeatureFlagsPlugin').useRozeniteFeatureFlagsPlugin;

// Neither Lynx runtime has a `window`, so `typeof window` alone reported
// every Lynx app as a server and installed the no-op stub below. `lynx` is
// a free binding in module scope, not a property of `globalThis`. Kept
// inline rather than imported so this stays a foldable expression and the
// `require`s below can still be dropped from production bundles.
declare const lynx: unknown;

const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined' && typeof lynx === 'undefined';

if (!isDev || isServer) {
  // Stubs read their options defensively: a production build must never be the
  // place a malformed call first crashes, so a missing options object degrades
  // to a named inert provider rather than a TypeError.
  const createNoopProvider = (
    options: { id?: string; name?: string } | undefined,
    defaultId: string,
    defaultName: string,
  ) => ({
    id: options?.id ?? defaultId,
    name: options?.name ?? defaultName,
    listFlags: () => [],
    setOverride: () => {},
    clearOverride: () => {},
    clearAllOverrides: () => {},
  });

  createCustomFlagsAdapter = ((options: { id?: string; name?: string } | undefined) =>
    createNoopProvider(options, 'custom', 'Custom flags')) as typeof createCustomFlagsAdapter;
  createLaunchDarklyFlagsAdapter = ((
    options: { client?: unknown; id?: string; name?: string } | undefined,
  ) => ({
    provider: createNoopProvider(options, 'launchdarkly', 'LaunchDarkly'),
    // Identity passthrough: no `Proxy`, zero overhead in production.
    client: options?.client,
  })) as typeof createLaunchDarklyFlagsAdapter;
  createStatsigFlagsAdapter = ((options: { id?: string; name?: string } | undefined) =>
    createNoopProvider(options, 'statsig', 'Statsig')) as typeof createStatsigFlagsAdapter;
  createFlagOverrides = (() => ({
    get: () => undefined,
    has: () => false,
    getAll: () => ({}),
    set: () => {},
    clear: () => {},
    clearAll: () => {},
    subscribe: () => ({ remove: () => {} }),
  })) as typeof createFlagOverrides;
  useRozeniteFeatureFlagsPlugin = () => null;
} else {
  // None of the adapters have a native dependency of their own (LaunchDarkly's
  // and Statsig's SDKs are only ever structurally typed against, never
  // imported), so the web and native paths are identical here.
  createCustomFlagsAdapter = require('./src/react-native/adapters').createCustomFlagsAdapter;
  createLaunchDarklyFlagsAdapter =
    require('./src/react-native/adapters').createLaunchDarklyFlagsAdapter;
  createStatsigFlagsAdapter = require('./src/react-native/adapters').createStatsigFlagsAdapter;
  createFlagOverrides = require('./src/react-native/overrides').createFlagOverrides;
  useRozeniteFeatureFlagsPlugin =
    require('./src/react-native/useRozeniteFeatureFlagsPlugin').useRozeniteFeatureFlagsPlugin;
}
