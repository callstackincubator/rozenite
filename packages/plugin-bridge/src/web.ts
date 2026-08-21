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

/**
 * Module-scoped ambient declaration for Lynx's `lynx` binding -- local to
 * this file (which is a module), so it never reaches the shipped
 * `dist/index.d.ts` and cannot collide with `@lynx-js/types`'s own global
 * declaration in a consuming app. It exists only so the `typeof lynx`
 * guard in `isLynx` type-checks.
 */
declare const lynx: LynxGlobal | undefined;

export const isLynx = (): boolean => {
  // Lynx's background runtime (BTS) has no `window`/`document`, so this
  // can't reuse `isWeb`'s check. `lynx.getDevtool` is Lynx's own devtool
  // channel -- the same capability `@lynx-js/preact-devtools` keys off --
  // and is exactly what `@rozenite/lynx` needs, so its presence is what
  // this detects Lynx by.
  //
  // `lynx` is NOT a property of `globalThis` in Lynx's background (BTS)
  // runtime -- it is injected as a free binding into each bundle's module
  // scope, the same way Node injects `require`/`module`. Verified on
  // LynxExplorer/iOS (Lynx engine 4.0, PrimJS): inside a background bundle
  // `typeof lynx === 'object'` and `lynx.getDevtool === 'function'`, while
  // `globalThis.lynx === undefined`. Reading it off `globalThis` (as this
  // did originally) therefore always reported `false` on a real device,
  // which sent every Lynx app down `isServer()` and threw
  // `UnsupportedPlatformError('server')` before any plugin could connect.
  //
  // `typeof` on an undeclared identifier is defined to return 'undefined'
  // rather than throwing, so the bare reference stays safe on every
  // non-Lynx host (web, React Native, Node).
  const candidate = typeof lynx !== 'undefined' ? lynx : (globalThis as { lynx?: LynxGlobal }).lynx;

  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.getDevtool === 'function'
  );
};
