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

/**
 * A server-side (SSR) runtime.
 *
 * Check `isLynx`/`isLynxMainThread` before trusting this: neither Lynx
 * runtime has a `window`, so both answer `true` here. Every caller in this
 * package handles Lynx first, which is why this stays the plain check.
 */
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

/**
 * Module-scoped ambient declaration for Lynx's `__BACKGROUND__` build-time
 * flag, declared the same way and for the same reason as `lynx` above.
 */
declare const __BACKGROUND__: boolean | undefined;

const hasLynxDevtool = (): boolean => {
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

/**
 * Whether this is Lynx's background (BTS) runtime rather than its
 * main-thread (scripting/Lepus) one.
 *
 * Lynx evaluates an app's entry module in *both* runtimes, and `lynx`
 * -- `getDevtool` included -- exists in both, so `hasLynxDevtool()` alone
 * cannot tell them apart. `@rozenite/lynx` deliberately installs
 * `__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__` in the background runtime only
 * (see its `setupRozenite`), because that is where app JS and plugin
 * device code run. Treating the main thread as Lynx therefore sent it into
 * `getCdpDomainProxy()`, which dereferenced the dispatcher that is never
 * installed there and threw `cannot read property 'BINDING_NAME' of
 * undefined` on every app start -- verified on LynxExplorer/Android
 * (Lynx engine 4.0), where the two runtimes probe as
 * `getDevtool=function background=true` and
 * `getDevtool=function background=false` respectively.
 *
 * `__BACKGROUND__` is a build-time constant that Lynx's bundler
 * substitutes, so it is read through `typeof` (and via `globalThis` as a
 * fallback) to stay safe on hosts that never define it. When nothing
 * defines it there is no second runtime to confuse this with, so the
 * answer is "background" -- keeping React Native and web behaviour
 * exactly as it was.
 */
const isLynxBackgroundRuntime = (): boolean => {
  if (typeof __BACKGROUND__ !== 'undefined') {
    return __BACKGROUND__ === true;
  }

  const fromGlobal = (globalThis as { __BACKGROUND__?: unknown }).__BACKGROUND__;

  if (typeof fromGlobal === 'boolean') {
    return fromGlobal;
  }

  return true;
};

export const isLynx = (): boolean => {
  return hasLynxDevtool() && isLynxBackgroundRuntime();
};

/**
 * Lynx's main-thread runtime, where Rozenite's device runtime is absent by
 * design. Callers use this to fail with a clear
 * `UnsupportedPlatformError` instead of falling through to `isServer()`,
 * which would also be true here (Lynx has no `window` in either runtime)
 * but would report the platform as "server".
 */
export const isLynxMainThread = (): boolean => {
  return hasLynxDevtool() && !isLynxBackgroundRuntime();
};
