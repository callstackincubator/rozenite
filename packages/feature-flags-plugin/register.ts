// Production entry point (`@rozenite/feature-flags-plugin/register`).
//
// The app consults the override store at flag-evaluation time, and the
// LaunchDarkly adapter's wrapped `client` must be threaded into a real
// `<LDProvider>` - both are ordinary app code that runs in production, so
// these touchpoints are declared safe via `productionEntries` in
// `rozenite.config.ts`. Import from the underlying `src/**` modules
// directly, never from `./react-native.ts`: that shim pulls in the plugin's
// whole dev surface, which is exactly what this entry point exists to keep
// out of the production bundle.
//
// `createStatsigFlagsAdapter` is intentionally left out: unlike the
// LaunchDarkly adapter, it does not return a wrapped client for you to pass
// to a provider - you construct `StatsigClient`/`LocalOverrideAdapter`
// yourself and hand them straight to Statsig's own provider. The adapter's
// only consumer is `useRozeniteFeatureFlagsPlugin`, which stays dev-only, so
// there is no production call site for it.
export {
  createCustomFlagsAdapter,
  createLaunchDarklyFlagsAdapter,
} from './src/react-native/adapters';
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

export { createFlagOverrides } from './src/react-native/overrides';
export type { FlagOverrides, FlagOverridesOptions } from './src/react-native/overrides';
