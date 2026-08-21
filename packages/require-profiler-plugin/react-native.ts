import { isServer as isServerRuntime } from '@rozenite/plugin-bridge';

export let useRequireProfilerDevTools: typeof import('./src/react-native/useRequireProfilerDevTools').useRequireProfilerDevTools;

const isWeb = typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isDev = process.env.NODE_ENV !== 'production';
const isServer = isServerRuntime();

if (isDev && !isWeb && !isServer) {
  useRequireProfilerDevTools =
    require('./src/react-native/useRequireProfilerDevTools').useRequireProfilerDevTools;
} else {
  useRequireProfilerDevTools = () => null;
}
