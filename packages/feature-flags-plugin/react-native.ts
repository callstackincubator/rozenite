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
  FeatureFlagInput,
} from './src/react-native/adapters';

export type { FlagOverrides, FlagOverridesOptions } from './src/react-native/overrides';

export let createCustomFlagsAdapter: typeof import('./src/react-native/adapters').createCustomFlagsAdapter;
export let createFlagOverrides: typeof import('./src/react-native/overrides').createFlagOverrides;

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
  createFlagOverrides = (() => ({
    get: () => undefined,
    has: () => false,
    getAll: () => ({}),
    set: () => {},
    clear: () => {},
    clearAll: () => {},
    subscribe: () => ({ remove: () => {} }),
  })) as typeof createFlagOverrides;
} else {
  // The custom adapter has no native dependency, so the web and native paths
  // are identical here.
  createCustomFlagsAdapter = require('./src/react-native/adapters').createCustomFlagsAdapter;
  createFlagOverrides = require('./src/react-native/overrides').createFlagOverrides;
}
