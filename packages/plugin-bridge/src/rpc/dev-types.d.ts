// Ambient declaration for the React Native / Metro global.
//
// `packages/web/globals.d.ts` declares `__DEV__` for the web bundle, but
// plugin-bridge is isomorphic (device + panel) and has no equivalent. We
// declare it here as possibly-undefined so `typeof __DEV__ !== 'undefined'`
// works whether or not the runtime actually defines it (Metro/Hermes define
// it, plain Node and browsers do not).
declare global {
  var __DEV__: boolean | undefined;
}

export {};
