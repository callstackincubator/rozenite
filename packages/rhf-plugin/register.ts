// Production entry point (`@rozenite/rhf-plugin/register`).
//
// `useRozeniteRHFPlugin` takes the `control`/`reset` of one specific
// `useForm()` instance, so it is called once per form inside ordinary screen
// components - it cannot be hoisted to a single dev-entry mount point, so
// this touchpoint is declared safe via `productionEntries` in
// `rozenite.config.ts`.
//
// Re-exported from `./react-native` rather than from `./src/**` directly.
// Being reachable in production is not the same as being active in it: the
// root entry already resolves this to a noop once `process.env.NODE_ENV` is
// folded, and going straight to the implementation would subscribe to and
// serialize form state on every change in a shipped app. Re-exporting keeps
// one definition of that production behaviour instead of a second copy here
// that could drift from it, and `register.js` is emitted into the same tree
// as `react-native.js`, so both entry points share one module instance.
export { useRozeniteRHFPlugin } from './react-native';
export type { UseRozeniteRHFPluginOptions } from './src/react-native/useRozeniteRHFPlugin';
export type { FieldError, FormSnapshot } from './src/shared/types';
