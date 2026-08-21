// Production entry point (`@rozenite/redux-devtools-plugin/register`).
//
// A store enhancer is applied where the store is created, which is ordinary
// app code that runs in production - so this touchpoint is declared safe via
// `productionEntries` in `rozenite.config.ts`.
//
// Re-exported from `./react-native` rather than from `./src/**` directly.
// Being reachable in production is not the same as being active in it: the
// root entry already resolves each of these to a pass-through noop once
// `process.env.NODE_ENV` is folded, and going straight to the implementation
// would install a live enhancer - retaining `maxAge` actions and serializing
// every dispatch - in a shipped app. Re-exporting keeps one definition of
// that production behaviour instead of a second copy here that could drift
// from it, and `register.js` is emitted into the same tree as
// `react-native.js`, so both entry points share one module instance.
export { rozeniteDevToolsEnhancer, composeWithRozeniteDevTools } from './react-native';
export type { RozeniteDevToolsOptions } from './src/runtime';
