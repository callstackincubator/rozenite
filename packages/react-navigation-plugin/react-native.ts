import { isServer as isServerRuntime } from '@rozenite/plugin-bridge';

export let useReactNavigationDevTools: typeof import('./src/react-native').useReactNavigationDevTools;
const isDev = process.env.NODE_ENV !== 'production';
const isServer = isServerRuntime();

if (isDev && !isServer) {
  useReactNavigationDevTools = require('./src/react-native').useReactNavigationDevTools;
} else {
  useReactNavigationDevTools = () => null;
}
