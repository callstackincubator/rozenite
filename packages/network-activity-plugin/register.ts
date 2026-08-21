// Production entry point (`@rozenite/network-activity-plugin/register`).
//
// The README documents calling `withOnBootNetworkActivityRecording` "at the
// root of your app, before any other imports", i.e. from `index.js` - a file
// that always ships in production - so this touchpoint is declared safe via
// `productionEntries` in `rozenite.config.ts`.
//
// Re-exported from `./react-native` rather than from `./src/**` directly.
// Being reachable in production is not the same as being active in it: the
// root entry already resolves this to a noop once `process.env.NODE_ENV` is
// folded, and going straight to the implementation would patch `fetch`/XHR
// and buffer every request in a shipped app, with nothing draining the
// buffer. Re-exporting keeps one definition of that production behaviour
// instead of a second copy here that could drift from it, and `register.js`
// is emitted into the same tree as `react-native.js`, so both entry points
// share one module instance.
export { withOnBootNetworkActivityRecording } from './react-native';
export type { BootRecordingOptions } from './src/react-native/boot-recording';
