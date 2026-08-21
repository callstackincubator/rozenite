import { isServer as isServerRuntime } from '@rozenite/plugin-bridge';

export let RozeniteOverlay: typeof import('./src/react-native/RozeniteOverlay').RozeniteOverlay;

const isDev = process.env.NODE_ENV !== 'production';
const isServer = isServerRuntime();

if (isDev && !isServer) {
  RozeniteOverlay = require('./src/react-native/RozeniteOverlay').RozeniteOverlay;
} else {
  RozeniteOverlay = () => null;
}
