export type { UseRozeniteRHFPluginOptions } from './src/react-native/useRozeniteRHFPlugin';
export type { FieldError, FormSnapshot } from './src/shared/types';

export let useRozeniteRHFPlugin: typeof import('./src/react-native/useRozeniteRHFPlugin').useRozeniteRHFPlugin;

const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (!isDev || isServer) {
  useRozeniteRHFPlugin = () => undefined;
} else {
  useRozeniteRHFPlugin =
    require('./src/react-native/useRozeniteRHFPlugin').useRozeniteRHFPlugin;
}
