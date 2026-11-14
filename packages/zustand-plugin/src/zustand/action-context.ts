/**
 * Attribution of `set` calls to the action that caused them.
 *
 * While a wrapped action runs synchronously it sits on `callStack`, so every
 * `set` it makes -- in its own store or another one -- knows its name. After
 * an `await` that context is gone (Hermes has no async context), so each store
 * keeps the actions of its own that returned a promise until they settle: a
 * `set` with no synchronous context is attributed to the store's single
 * pending call. With none or several pending it is anonymous: we never guess.
 */

export type CallEntry = {
  storeName: string;
  name: string;
  args: unknown[];
};

export const callStack: CallEntry[] = [];

export const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
