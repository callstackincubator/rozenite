export let useNetworkActivityDevTools: typeof import('./src/react-native/useNetworkActivityDevTools').useNetworkActivityDevTools;
export let withOnBootNetworkActivityRecording: typeof import('./src/react-native/withOnBootNetworkActivityRecording').withOnBootNetworkActivityRecording;

// Export types for user-facing configuration
export type { NetworkActivityDevToolsConfig } from './src/react-native/config';
export type { BootRecordingOptions } from './src/react-native/withOnBootNetworkActivityRecording';

const isWeb =
  typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isWeb && !isServer) {
  useNetworkActivityDevTools = require('./src/react-native/useNetworkActivityDevTools').useNetworkActivityDevTools;
  withOnBootNetworkActivityRecording = require('./src/react-native/withOnBootNetworkActivityRecording').withOnBootNetworkActivityRecording;
} else {
  useNetworkActivityDevTools = () => null;
  withOnBootNetworkActivityRecording = (options: any) => null;
}
