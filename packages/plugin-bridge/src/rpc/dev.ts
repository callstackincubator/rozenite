/**
 * Whether we're running in a development build.
 *
 * `__DEV__` is checked first so Metro dead-code-strips the branch on release
 * builds; `process.env.NODE_ENV` covers the panel (web) and Node. We
 * deliberately do not use `import.meta.env` — this package also emits CJS.
 *
 * This must only be used on the RPC *receiver* side, where a handler's
 * error is thrown — a production device must never put a stack trace on
 * the wire.
 */
export const isDev = (): boolean =>
  typeof __DEV__ !== 'undefined'
    ? Boolean(__DEV__)
    : typeof process !== 'undefined' &&
      process.env?.['NODE_ENV'] !== 'production';
