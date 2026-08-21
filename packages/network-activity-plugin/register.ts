// Production entry point (`@rozenite/network-activity-plugin/register`).
//
// The README documents calling `withOnBootNetworkActivityRecording` "at the
// root of your app, before any other imports", i.e. from `index.js` - a file
// that always ships in production - so this touchpoint is declared safe via
// `productionEntries` in `rozenite.config.ts`. Import from the underlying
// `src/**` modules directly, never from `./react-native.ts`: that shim pulls
// in the plugin's whole dev surface, which is exactly what this entry point
// exists to keep out of the production bundle.
export { withOnBootNetworkActivityRecording } from './src/react-native/boot-recording';
export type { BootRecordingOptions } from './src/react-native/boot-recording';
