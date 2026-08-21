export let useNetworkActivityDevTools: typeof import('./src/react-native/useNetworkActivityDevTools').useNetworkActivityDevTools;
export let withOnBootNetworkActivityRecording: typeof import('./src/react-native/boot-recording').withOnBootNetworkActivityRecording;

// Export types for user-facing configuration
export type { NetworkActivityDevToolsConfig } from './src/react-native/config';
export type { BootRecordingOptions } from './src/react-native/boot-recording';

const isWeb = typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
// Neither Lynx runtime has a `window`, so `typeof window` alone reported
// every Lynx app as a server and installed the no-op stub below. `lynx` is
// a free binding in module scope, not a property of `globalThis`. Kept
// inline rather than imported so this stays a foldable expression and the
// `require`s below can still be dropped from production bundles.
declare const lynx: unknown;

const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined' && typeof lynx === 'undefined';

if (isDev && !isWeb && !isServer) {
  useNetworkActivityDevTools =
    require('./src/react-native/useNetworkActivityDevTools').useNetworkActivityDevTools;
  withOnBootNetworkActivityRecording =
    require('./src/react-native/boot-recording').withOnBootNetworkActivityRecording;
} else {
  useNetworkActivityDevTools = () => null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  withOnBootNetworkActivityRecording = (options: any) => null;
}
