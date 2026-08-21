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

const getLynxGlobal = (): LynxGlobal | undefined => {
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
