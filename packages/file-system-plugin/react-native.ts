export type {
  UseFileSystemDevToolsOptions,
} from './src/react-native/useFileSystemDevTools';

export let useFileSystemDevTools: typeof import('./src/react-native/useFileSystemDevTools').useFileSystemDevTools;

const isWeb =
  typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isWeb && !isServer) {
  useFileSystemDevTools =
    require('./src/react-native/useFileSystemDevTools').useFileSystemDevTools;
} else {
  useFileSystemDevTools = () => null;
}
