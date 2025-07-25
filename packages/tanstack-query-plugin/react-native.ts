export let useTanStackQueryDevTools: typeof import('./src/react-native/useTanStackQueryDevTools').useTanStackQueryDevTools;

if (process.env.NODE_ENV !== 'production') {
  useTanStackQueryDevTools =
    require('./src/react-native/useTanStackQueryDevTools').useTanStackQueryDevTools;
} else {
  useTanStackQueryDevTools = () => ({ isConnected: false });
}
