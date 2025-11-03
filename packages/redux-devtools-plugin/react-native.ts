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
  // Noop enhancer: returns an enhancer that passes through createStore unchanged
  const noopEnhancer =
    () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createStore: (...args: any[]) => any) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (...args: any[]) =>
      createStore(...args);

  // Noop composer: returns a compose function (which composes enhancers)
  const noopComposer = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (...enhancers: any[]) => {
      if (enhancers.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (createStore: (...args: any[]) => any) => createStore;
      }
      if (enhancers.length === 1) {
        return enhancers[0];
      }
      // Compose enhancers from right to left (Redux's compose behavior)
      return enhancers.reduceRight(
        (composed, enhancer) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (createStore: (...args: any[]) => any) =>
            enhancer(composed(createStore))
      );
    };
  };

  rozeniteDevToolsEnhancer = noopEnhancer;
  composeWithRozeniteDevTools = noopComposer;
}
