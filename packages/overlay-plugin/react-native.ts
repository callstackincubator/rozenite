export let RozeniteOverlay: typeof import('./src/react-native/RozeniteOverlay').RozeniteOverlay;

const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isServer) {
  RozeniteOverlay =
    require('./src/react-native/RozeniteOverlay').RozeniteOverlay;
} else {
  RozeniteOverlay = () => null;
}

