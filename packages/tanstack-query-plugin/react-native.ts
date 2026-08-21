import { isServer as isServerRuntime } from '@rozenite/plugin-bridge';

export let useTanStackQueryDevTools: typeof import('./src/react-native/useTanStackQueryDevTools').useTanStackQueryDevTools;

const isDev = process.env.NODE_ENV !== 'production';
const isServer = isServerRuntime();

if (isDev && !isServer) {
  useTanStackQueryDevTools =
    require('./src/react-native/useTanStackQueryDevTools').useTanStackQueryDevTools;
} else {
  useTanStackQueryDevTools = () => ({ isConnected: false });
}
