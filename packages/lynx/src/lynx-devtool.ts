/**
 * A minimal typing for the object `lynx.getDevtool()` returns. It is Lynx's
 * own bidirectional devtool channel, verified against `@lynx-js/preact-devtools`
 * (the working precedent for this exact technique).
 */
export type DevtoolEvent = {
  type: string;
  data: string;
};

export type DevtoolContextProxy = {
  postMessage: (message: unknown) => void;
  dispatchEvent: (event: DevtoolEvent) => unknown;
  addEventListener: (type: string, listener: (event: DevtoolEvent) => void) => void;
  removeEventListener: (type: string, listener: (event: DevtoolEvent) => void) => void;
};

/**
 * Structural, locally-scoped type for the Lynx global. Kept private to this
 * module (never declared as an ambient global — see `./global.d.ts`) so it
 * cannot collide with `@lynx-js/types`'s own `declare const lynx: ...` in a
 * consuming app.
 */
type LynxGlobal = {
  getDevtool?: () => DevtoolContextProxy;
};

/**
 * Module-scoped ambient declaration for Lynx's `lynx` binding.
 *
 * Declared here rather than in `./global.d.ts` on purpose: inside a module
 * (this file has imports/exports) a `declare const` is local to the file,
 * so it never reaches this package's shipped `dist/index.d.ts` and cannot
 * collide with `@lynx-js/types`'s own global declaration in a consuming
 * app. It exists only so the `typeof lynx` guard below type-checks.
 */
declare const lynx: LynxGlobal | undefined;

const getLynxGlobal = (): LynxGlobal | undefined => {
  // `lynx` is NOT a property of `globalThis` in Lynx's background (BTS)
  // runtime -- it is injected as a free binding into each bundle's module
  // scope, the same way Node injects `require`/`module`. Verified on
  // LynxExplorer/iOS (Lynx engine 4.0, PrimJS): inside a background bundle
  // `typeof lynx === 'object'` and `lynx.getDevtool === 'function'`, while
  // `globalThis.lynx === undefined`. Reading it off `globalThis` (as this
  // did originally) therefore always failed on a real device.
  //
  // `typeof` on an undeclared identifier is defined to return 'undefined'
  // rather than throwing, so this stays safe on every non-Lynx host.
  if (typeof lynx !== 'undefined' && lynx !== null) {
    return lynx;
  }

  // Kept as a fallback for any host that does expose it as a property.
  return (globalThis as { lynx?: LynxGlobal }).lynx;
};

/**
 * Whether `lynx.getDevtool` is available in the current runtime. Used to
 * decide whether it's safe to open a domain before attempting it.
 */
export const isDevtoolAvailable = (): boolean => {
  return typeof getLynxGlobal()?.getDevtool === 'function';
};

/**
 * Resolves Lynx's devtool channel, throwing a clear, actionable error if it
 * isn't available. Mirrors the wording style of `@lynx-js/preact-devtools`'s
 * own capability check.
 */
export const getDevtool = (): DevtoolContextProxy => {
  const lynxGlobal = getLynxGlobal();

  if (typeof lynxGlobal?.getDevtool !== 'function') {
    throw new Error(
      '`lynx.getDevtool` is not a function: on native Lynx, please upgrade your LynxSDK to the latest version; ' +
        'if you are running outside of a Lynx runtime (e.g. plain Node or a browser), `@rozenite/lynx` cannot be used there.',
    );
  }

  return lynxGlobal.getDevtool();
};
