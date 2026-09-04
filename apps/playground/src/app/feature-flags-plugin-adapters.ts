// FeatureFlagsPluginScreen calls `featureFlagsPluginAdapter.listFlags()` and
// `featureFlagsOverrides.subscribe(...)` at runtime to render live flag
// values, so this adapter is production-reachable — `/register` is the
// declared production entry the build-time guard permits here. Only the
// `useRozeniteFeatureFlagsPlugin({ providers: ... })` call is dev-only and
// lives in rozenite.dev/index.tsx.
import {
  createCustomFlagsAdapter,
  createFlagOverrides,
  type FeatureFlagInput,
} from '@rozenite/feature-flags-plugin/register';

// The custom/local adapter is Tier B (the plugin owns the override store),
// but it needs zero call-site changes: the app reads flags straight from
// `listFlags()`/the override store, same as it would without Rozenite.
export const playgroundFlagDeclarations: FeatureFlagInput[] = [
  { key: 'new-checkout-flow', value: false, type: 'boolean' },
  { key: 'welcome-message', value: 'Welcome to the Rozenite Playground!', type: 'string' },
  { key: 'max-retry-count', value: 3, type: 'number' },
  {
    key: 'theme-config',
    value: { accentColor: '#4f46e5', roundedCorners: true },
    type: 'json',
  },
];

// Shared between the DevTools-facing adapter and the demo screen so an
// override set from the Feature Flags panel is observable in the app
// immediately, without a round trip through the RPC layer.
export const featureFlagsOverrides = createFlagOverrides();

export const featureFlagsPluginAdapter = createCustomFlagsAdapter({
  id: 'app',
  name: 'App flags',
  listFlags: () => playgroundFlagDeclarations,
  overrides: featureFlagsOverrides,
});

// Hoisted to module scope, matching `storagePluginAdapters`/
// `sqlitePluginAdapters` -- `useRozeniteFeatureFlagsPlugin` is robust to a
// fresh array literal on every render, but a stable reference is still good
// practice.
export const featureFlagsPluginAdapters = [featureFlagsPluginAdapter];
