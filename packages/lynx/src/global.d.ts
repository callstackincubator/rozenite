/**
 * `__BACKGROUND__` is a Lynx bundler-injected global: it is replaced with a
 * literal `true`/`false` at build time depending on whether the enclosing
 * bundle is the background (BTS) runtime or the main-thread (scripting)
 * runtime, the same way React Native's Metro replaces `__DEV__`.
 *
 * Deliberately NOT declared here: `lynx`. `@lynx-js/types` already declares
 * that global for consumers, and redeclaring it in this package's shipped
 * `dist/index.d.ts` would risk colliding with (widening or narrowing) that
 * declaration in an app that imports both. See `./lynx-devtool.ts`, which
 * reads `lynx` off `globalThis` through a locally-scoped structural type
 * instead of relying on an ambient declaration.
 */
declare const __BACKGROUND__: boolean;

/**
 * A minimal structural declaration for `console`, which is present in every
 * Lynx runtime this package targets. Declared locally instead of pulling in
 * the `dom` or `node` lib: neither describes this package's actual target
 * environment (PrimJS on Lynx has neither the DOM nor Node's globals), and
 * pulling either in would leak unrelated ambient globals into this
 * package's compilation.
 */
declare const console: {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};
