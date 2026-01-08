export let RozeniteOverlay: typeof import('./src/react-native/RozeniteOverlay').RozeniteOverlay;

const isWeb =
  typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isWeb && !isServer) {
  RozeniteOverlay =
    require('./src/react-native/RozeniteOverlay').RozeniteOverlay;
} else {
  RozeniteOverlay = () => null;
}

