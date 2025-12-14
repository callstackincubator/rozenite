export let useNetworkActivityDevTools: typeof import('./src/react-native/useNetworkActivityDevTools').useNetworkActivityDevTools;
export let withOnBootNetworkActivityRecording: typeof import('./src/react-native/withOnBootNetworkActivityRecording').withOnBootNetworkActivityRecording;

const isWeb =
  typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isWeb && !isServer) {
  withOnBootNetworkActivityRecording =
    require('./src/react-native/withOnBootNetworkActivityRecording').withOnBootNetworkActivityRecording;

  useNetworkActivityDevTools =
    require('./src/react-native/useNetworkActivityDevTools').useNetworkActivityDevTools;
} else {
  useNetworkActivityDevTools = () => null;
  withOnBootNetworkActivityRecording = () => null;
}
