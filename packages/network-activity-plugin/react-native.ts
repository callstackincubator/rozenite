export let useNetworkActivityDevTools: typeof import('./src/react-native/useNetworkActivityDevTools').useNetworkActivityDevTools;

const isWeb =
  typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isWeb && !isServer) {
  useNetworkActivityDevTools =
    require('./src/react-native/useNetworkActivityDevTools').useNetworkActivityDevTools;
} else {
  useNetworkActivityDevTools = () => null;
}
