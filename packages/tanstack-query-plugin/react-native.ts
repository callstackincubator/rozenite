export let useTanStackQueryDevTools: typeof import('./src/react-native/useTanStackQueryDevTools').useTanStackQueryDevTools;

const isWeb =
  typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isWeb && !isServer) {
  useTanStackQueryDevTools =
    require('./src/react-native/useTanStackQueryDevTools').useTanStackQueryDevTools;
} else {
  useTanStackQueryDevTools = () => ({ isConnected: false });
}
