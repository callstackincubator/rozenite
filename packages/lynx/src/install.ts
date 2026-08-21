import { FuseboxReactDevToolsDispatcher } from './dispatcher.js';

/**
 * Installs the `__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__` global that
 * `@rozenite/plugin-bridge`'s device-side CDP channel talks to.
 *
 * Only installs in the background (BTS) runtime: `lynx.getDevtool()` only
 * exists there, which is also where app JS and Rozenite plugin device code
 * run. In the main-thread (scripting) runtime `__BACKGROUND__` is `false`
 * and this is a no-op.
 *
 * Idempotent: safe to call more than once (and safe if something else
 * already installed the same global first), matching the guard in the
 * upstream React Native module this package forks.
 */
export const setupRozenite = (): void => {
  if (!__BACKGROUND__) {
    return;
  }

  if ((globalThis as Record<string, unknown>).__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__ != null) {
    return;
  }

  Object.defineProperty(globalThis, '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__', {
    value: FuseboxReactDevToolsDispatcher,
    configurable: false,
    enumerable: false,
    writable: false,
  });
};
