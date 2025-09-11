export let useReactNavigationDevTools: typeof import('./src/react-native').useReactNavigationDevTools;

const isWeb =
  typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isWeb && !isServer) {
  useReactNavigationDevTools =
    require('./src/react-native').useReactNavigationDevTools;
} else {
  useReactNavigationDevTools = () => null;
}
