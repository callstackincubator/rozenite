export let useNetworkActivityDevTools: typeof import('./src/react-native/useNetworkActivityDevTools').useNetworkActivityDevTools;
export let withOnBootNetworkActivityRecording: typeof import('./src/react-native/http/queued-xhr-interceptor').withOnBootNetworkActivityRecording;

const isWeb =
  typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isWeb && !isServer) {
  // Eagerly load the queued interceptor to start capturing requests from app boot
  const queuedInterceptorModule = require('./src/react-native/http/queued-xhr-interceptor');
  withOnBootNetworkActivityRecording = queuedInterceptorModule.withOnBootNetworkActivityRecording;
  
  useNetworkActivityDevTools =
    require('./src/react-native/useNetworkActivityDevTools').useNetworkActivityDevTools;
} else {
  useNetworkActivityDevTools = () => null;
  withOnBootNetworkActivityRecording = () => null;
}
