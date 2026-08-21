export const isWeb = (): boolean => {
  // Checking for window.document to not depend on the 'react-native' package.
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
};

declare global {
  var __ROZENITE_WEB__: unknown;
}

export const isRozeniteWeb = (): boolean => {
  return isWeb() && typeof window.__ROZENITE_WEB__ !== 'undefined';
};

export const isServer = (): boolean => {
  return typeof window === 'undefined';
};

// Structural types for Lynx's devtool channel (`lynx.getDevtool()`), kept
// local instead of ambient/global so they cannot collide with an app's own
// `@lynx-js/types`. See `isLynx` below.
type DevtoolEvent = { type: string; data: string };
type DevtoolContextProxy = {
  postMessage: (message: unknown) => void;
  dispatchEvent: (event: DevtoolEvent) => unknown;
  addEventListener: (type: string, listener: (event: DevtoolEvent) => void) => void;
  removeEventListener: (type: string, listener: (event: DevtoolEvent) => void) => void;
};
type LynxGlobal = {
  getDevtool?: () => DevtoolContextProxy;
};

export const isLynx = (): boolean => {
  // Lynx's background runtime (BTS) has no `window`/`document`, so this
  // can't reuse `isWeb`'s check. `lynx.getDevtool` is Lynx's own devtool
  // channel -- the same capability `@lynx-js/preact-devtools` keys off --
  // and is exactly what `@rozenite/lynx` needs, so its presence is what
  // this detects Lynx by. Read `lynx` off `globalThis` through a local
  // structural type (not a `declare global`/bare `declare const lynx`) so
  // this can't clash with an app's own `@lynx-js/types`, and use a
  // `typeof` chain so it never throws on an exotic host.
  const lynx = (globalThis as { lynx?: LynxGlobal }).lynx;
  return typeof lynx === 'object' && lynx !== null && typeof lynx.getDevtool === 'function';
};
