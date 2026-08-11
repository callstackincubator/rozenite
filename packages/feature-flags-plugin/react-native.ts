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
  FeatureFlagInput,
  LaunchDarklyFlagsAdapter,
  LDClientLike,
  LDEvaluationDetailLike,
  LDEvaluationReason,
  LDFlagSet,
} from './src/react-native/adapters';

export type { FlagOverrides, FlagOverridesOptions } from './src/react-native/overrides';

export let createCustomFlagsAdapter: typeof import('./src/react-native/adapters').createCustomFlagsAdapter;
export let createLaunchDarklyFlagsAdapter: typeof import('./src/react-native/adapters').createLaunchDarklyFlagsAdapter;
export let createFlagOverrides: typeof import('./src/react-native/overrides').createFlagOverrides;
export let useRozeniteFeatureFlagsPlugin: typeof import('./src/react-native/useRozeniteFeatureFlagsPlugin').useRozeniteFeatureFlagsPlugin;

const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (!isDev || isServer) {
  createCustomFlagsAdapter = ((options: { id: string; name: string }) => ({
    id: options.id,
    name: options.name,
    listFlags: () => [],
    setOverride: () => {},
    clearOverride: () => {},
    clearAllOverrides: () => {},
  })) as typeof createCustomFlagsAdapter;
  createLaunchDarklyFlagsAdapter = ((options: { client: unknown; id?: string; name?: string }) => ({
    provider: {
      id: options.id ?? 'launchdarkly',
      name: options.name ?? 'LaunchDarkly',
      listFlags: () => [],
      setOverride: () => {},
      clearOverride: () => {},
      clearAllOverrides: () => {},
    },
    // Identity passthrough: no `Proxy`, zero overhead in production.
    client: options.client,
  })) as typeof createLaunchDarklyFlagsAdapter;
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
  // Neither adapter has a native dependency of its own (LaunchDarkly's SDK
  // is only ever structurally typed against, never imported), so the web
  // and native paths are identical here.
  createCustomFlagsAdapter = require('./src/react-native/adapters').createCustomFlagsAdapter;
  createLaunchDarklyFlagsAdapter =
    require('./src/react-native/adapters').createLaunchDarklyFlagsAdapter;
  createFlagOverrides = require('./src/react-native/overrides').createFlagOverrides;
  useRozeniteFeatureFlagsPlugin =
    require('./src/react-native/useRozeniteFeatureFlagsPlugin').useRozeniteFeatureFlagsPlugin;
}
