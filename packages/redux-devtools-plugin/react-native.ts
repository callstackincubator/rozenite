export let rozeniteDevToolsEnhancer: typeof import('./src/runtime').rozeniteDevToolsEnhancer;

const isWeb =
  typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isWeb && !isServer) {
  rozeniteDevToolsEnhancer = require('./src/runtime').rozeniteDevToolsEnhancer;
} else {
  rozeniteDevToolsEnhancer =
    () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createStore: (...args: any[]) => any) =>
    (...args) =>
      createStore(...args);
}
