export let useReactNavigationDevTools: typeof import('./src/react-native').useReactNavigationDevTools;
// Neither Lynx runtime has a `window`, so `typeof window` alone reported
// every Lynx app as a server and installed the no-op stub below. `lynx` is
// a free binding in module scope, not a property of `globalThis`. Kept
// inline rather than imported so this stays a foldable expression and the
// `require`s below can still be dropped from production bundles.
declare const lynx: unknown;

const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined' && typeof lynx === 'undefined';

if (isDev && !isServer) {
  useReactNavigationDevTools = require('./src/react-native').useReactNavigationDevTools;
} else {
  useReactNavigationDevTools = () => null;
}
