export type { RozeniteDevToolsOptions } from './src/runtime';

export let rozeniteDevToolsEnhancer: typeof import('./src/runtime').rozeniteDevToolsEnhancer;
export let composeWithRozeniteDevTools: typeof import('./src/runtime').composeWithRozeniteDevTools;
export let useReduxDevToolsAgentTools: typeof import('./src/useReduxDevToolsAgentTools').useReduxDevToolsAgentTools;

// Neither Lynx runtime has a `window`, so `typeof window` alone reported
// every Lynx app as a server and installed the no-op stub below. `lynx` is
// a free binding in module scope, not a property of `globalThis`. Kept
// inline rather than imported so this stays a foldable expression and the
// `require`s below can still be dropped from production bundles.
declare const lynx: unknown;

const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined' && typeof lynx === 'undefined';

if (isDev && !isServer) {
  rozeniteDevToolsEnhancer = require('./src/runtime').rozeniteDevToolsEnhancer;
  composeWithRozeniteDevTools = require('./src/runtime').composeWithRozeniteDevTools;
  useReduxDevToolsAgentTools =
    require('./src/useReduxDevToolsAgentTools').useReduxDevToolsAgentTools;
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
        (composed, enhancer) => (createStore: (...args: any[]) => any) =>
          enhancer(composed(createStore)),
      );
    };
  };

  rozeniteDevToolsEnhancer = noopEnhancer as any;
  composeWithRozeniteDevTools = noopComposer as any;
  useReduxDevToolsAgentTools = (() => {
    // no-op in production/server environments
  }) as any;
}
