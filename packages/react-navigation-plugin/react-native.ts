export let useReactNavigationDevTools: typeof import('./src/react-native').useReactNavigationDevTools;
;
const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isServer) {
  useReactNavigationDevTools =
    require('./src/react-native').useReactNavigationDevTools;
} else {
  useReactNavigationDevTools = () => null;
}
