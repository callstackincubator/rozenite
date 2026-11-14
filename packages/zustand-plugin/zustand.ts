import type { StateCreator, StoreMutatorIdentifier } from 'zustand/vanilla';
import type { RozeniteOptions } from './src/zustand/middleware';

export type { RozeniteOptions } from './src/zustand/middleware';

type Write<T, U> = Omit<T, keyof U> & U;
type Cast<T, U> = T extends U ? T : U;

type TakeTwo<T> = T extends { length: 0 }
  ? [undefined, undefined]
  : T extends { length: 1 }
    ? [...args0: Cast<T, unknown[]>, arg1: undefined]
    : T extends { length: 0 | 1 }
      ? [...args0: Cast<T, unknown[]>, arg1: undefined]
      : T extends { length: 2 }
        ? T
        : T extends { length: 1 | 2 }
          ? T
          : T extends { length: 0 | 1 | 2 }
            ? T
            : T extends [infer A0, infer A1, ...unknown[]]
              ? [A0, A1]
              : T extends [infer A0, (infer A1)?, ...unknown[]]
                ? [A0, A1?]
                : T extends [(infer A0)?, (infer A1)?, ...unknown[]]
                  ? [A0?, A1?]
                  : never;

/** A third `set` argument names the transition, as with `devtools()`. */
export type RozeniteActionName = string | { type: string; [key: string]: unknown };

type StoreRozenite<S> = S extends {
  setState: {
    (...args: infer Sa1): infer Sr1;
    (...args: infer Sa2): infer Sr2;
  };
}
  ? {
      setState(...args: [...args: TakeTwo<Sa1>, action?: RozeniteActionName]): Sr1;
      setState(...args: [...args: TakeTwo<Sa2>, action?: RozeniteActionName]): Sr2;
    }
  : never;

type WithRozenite<S> = Write<S, StoreRozenite<S>>;

declare module 'zustand/vanilla' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface StoreMutators<S, A> {
    'rozenite/zustand': WithRozenite<S>;
  }
}

export type Rozenite = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
  U = T,
>(
  initializer: StateCreator<T, [...Mps, ['rozenite/zustand', never]], Mcs, U>,
  options: RozeniteOptions,
) => StateCreator<T, Mps, [['rozenite/zustand', never], ...Mcs], U>;

/**
 * Zustand middleware that records every state transition for the Rozenite
 * Zustand panel: action names and arguments (inferred from your store's
 * functions), diffs, traces, time travel, editing and persist info.
 * Place it outermost. Compiles to a pass-through in production.
 *
 * ```ts
 * const useCart = create(rozenite((set) => ({ … }), { name: 'Cart' }));
 * ```
 */
export let rozenite: Rozenite;

// Neither Lynx runtime has a `window`, so `typeof window` alone reported
// every Lynx app as a server and installed the no-op stub below. `lynx` is
// a free binding in module scope, not a property of `globalThis`. Kept
// inline rather than imported so this stays a foldable expression and the
// `require` below can still be dropped from production bundles.
declare const lynx: unknown;

const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined' && typeof lynx === 'undefined';

if (!isDev || isServer) {
  rozenite = ((initializer: unknown) => initializer) as Rozenite;
} else {
  rozenite = require('./src/zustand/middleware').rozeniteImpl as Rozenite;
}
