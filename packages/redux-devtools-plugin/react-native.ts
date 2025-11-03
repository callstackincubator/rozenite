export let rozeniteDevToolsEnhancer: typeof import('./src/runtime').rozeniteDevToolsEnhancer;
export let composeWithRozeniteDevTools: typeof import('./src/runtime').composeWithRozeniteDevTools;

const isWeb =
  typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isWeb && !isServer) {
  rozeniteDevToolsEnhancer = require('./src/runtime').rozeniteDevToolsEnhancer;
  composeWithRozeniteDevTools =
    require('./src/runtime').composeWithRozeniteDevTools;
} else {
  const noop =
    () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createStore: (...args: any[]) => any) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (...args: any[]) =>
      createStore(...args);

  rozeniteDevToolsEnhancer = noop;
  composeWithRozeniteDevTools = noop;
}
