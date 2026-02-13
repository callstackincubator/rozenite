export let useTanStackQueryDevTools: typeof import('./src/react-native/useTanStackQueryDevTools').useTanStackQueryDevTools;

const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isServer) {
  useTanStackQueryDevTools =
    require('./src/react-native/useTanStackQueryDevTools').useTanStackQueryDevTools;
} else {
  useTanStackQueryDevTools = () => ({ isConnected: false });
}
