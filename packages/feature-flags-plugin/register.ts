// Production entry point (`@rozenite/feature-flags-plugin/register`).
//
// The app consults the override store at flag-evaluation time, and the
// LaunchDarkly adapter's wrapped `client` must be threaded into a real
// `<LDProvider>` - both are ordinary app code that runs in production, so
// these touchpoints are declared safe via `productionEntries` in
// `rozenite.config.ts`.
//
// Re-exported from `./react-native` rather than from `./src/**` directly.
// Being reachable in production is not the same as being active in it: the
// root entry already resolves each of these to a noop once
// `process.env.NODE_ENV` is folded, so a shipped app reads its flags with no
// overrides applied and no evaluation interception. Re-exporting keeps one
// definition of that production behaviour instead of a second copy here that
// could drift from it, and `register.js` is emitted into the same tree as
// `react-native.js`, so both entry points share one module instance.
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
  createFlagOverrides,
} from './react-native';
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
