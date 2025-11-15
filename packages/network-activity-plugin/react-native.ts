export let useNetworkActivityDevTools: typeof import('./src/react-native/useNetworkActivityDevTools').useNetworkActivityDevTools;
export let getQueuedXHRInterceptor: typeof import('./src/react-native/http/queued-xhr-interceptor').getQueuedXHRInterceptor;

const isWeb =
  typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isWeb && !isServer) {
  // Eagerly load the queued interceptor to start capturing requests from app boot
  const queuedInterceptorModule = require('./src/react-native/http/queued-xhr-interceptor');
  console.log('[react-native.ts] Loaded queued-xhr-interceptor module');
  getQueuedXHRInterceptor = queuedInterceptorModule.getQueuedXHRInterceptor;
  
  useNetworkActivityDevTools =
    require('./src/react-native/useNetworkActivityDevTools').useNetworkActivityDevTools;
} else {
  useNetworkActivityDevTools = () => null;
  // @ts-expect-error - No-op stub for production/web
  getQueuedXHRInterceptor = () => ({
    getQueueSize: () => 0,
    clearQueue: () => {
      // No-op in production
    },
    isEnabled: () => false,
    setCallbacks: () => {
      // No-op in production
    },
    stopConsuming: () => {
      // No-op in production
    },
    disable: () => {
      // No-op in production
    },
  });
}
