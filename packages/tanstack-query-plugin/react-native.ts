
export let useTanstackQueryDevTools: typeof import('./src/react-native/useTanstackQueryDevTools').useTanstackQueryDevTools;

if (process.env.NODE_ENV !== 'production') {
  useTanstackQueryDevTools = require('./src/react-native/useTanstackQueryDevTools').useTanstackQueryDevTools;
} else {
  useTanstackQueryDevTools = () => ({ isConnected: false });
}
