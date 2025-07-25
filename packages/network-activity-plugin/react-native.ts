export let useNetworkActivityDevTools: typeof import('./src/react-native/useNetworkActivityDevTools').useNetworkActivityDevTools;

if (process.env.NODE_ENV !== 'production') {
  useNetworkActivityDevTools =
    require('./src/react-native/useNetworkActivityDevTools').useNetworkActivityDevTools;
} else {
  useNetworkActivityDevTools = () => null;
}
