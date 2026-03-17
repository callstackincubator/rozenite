export type { RozeniteDevToolsOptions } from './src/runtime';

export let rozeniteDevToolsEnhancer: typeof import('./src/runtime').rozeniteDevToolsEnhancer;
export let composeWithRozeniteDevTools: typeof import('./src/runtime').composeWithRozeniteDevTools;

const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isServer) {
  rozeniteDevToolsEnhancer = require('./src/runtime').rozeniteDevToolsEnhancer;
  composeWithRozeniteDevTools =
    require('./src/runtime').composeWithRozeniteDevTools;
} else {
  // Noop enhancer: returns an enhancer that passes through createStore unchanged
  const noopEnhancer =
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (options?: any) =>
      (createStore: (...args: any[]) => any) =>
        (...args: any[]) =>
          createStore(...args);

  // Noop composer: returns a compose function (which composes enhancers)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const noopComposer = (options?: any) => {
    return (...enhancers: any[]) => {
      if (enhancers.length === 0) {
        return (createStore: (...args: any[]) => any) => createStore;
      }
      if (enhancers.length === 1) {
        return enhancers[0];
      }
      // Compose enhancers from right to left (Redux's compose behavior)
      return enhancers.reduceRight(
        (composed, enhancer) =>
          (createStore: (...args: any[]) => any) =>
            enhancer(composed(createStore))
      );
    };
  };

  rozeniteDevToolsEnhancer = noopEnhancer as any;
  composeWithRozeniteDevTools = noopComposer as any;
}
