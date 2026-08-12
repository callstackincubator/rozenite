import type { FeatureFlagValue, FeatureFlagsSubscription } from '../shared/types';

export type FlagOverridesOptions = {
  /** Seed values, e.g. rehydrated from storage. */
  initial?: Record<string, FeatureFlagValue>;
  /** Called after every mutation with the full current override map. */
  onChange?: (overrides: Record<string, FeatureFlagValue>) => void;
};

export type FlagOverrides = {
  get(key: string): FeatureFlagValue | undefined;
  has(key: string): boolean;
  getAll(): Record<string, FeatureFlagValue>;
  set(key: string, value: FeatureFlagValue): void;
  clear(key: string): void;
  clearAll(): void;
  /** Notified after every mutation; used by adapters to fan out change events. */
  subscribe(callback: () => void): FeatureFlagsSubscription;
};

export const createFlagOverrides = (options?: FlagOverridesOptions): FlagOverrides => {
  const store = new Map<string, FeatureFlagValue>(Object.entries(options?.initial ?? {}));
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      try {
        listener();
      } catch (error) {
        console.error('[Rozenite] Feature Flags Plugin: override subscriber threw', error);
      }
    }

    options?.onChange?.(getAll());
  };

  const getAll = (): Record<string, FeatureFlagValue> => Object.fromEntries(store);

  return {
    get: (key) => store.get(key),
    has: (key) => store.has(key),
    getAll,
    set: (key, value) => {
      store.set(key, value);
      notify();
    },
    clear: (key) => {
      if (!store.has(key)) {
        return;
      }

      store.delete(key);
      notify();
    },
    clearAll: () => {
      if (store.size === 0) {
        return;
      }

      store.clear();
      notify();
    },
    subscribe: (callback) => {
      listeners.add(callback);

      let isRemoved = false;

      return {
        remove: () => {
          if (isRemoved) {
            return;
          }

          isRemoved = true;
          listeners.delete(callback);
        },
      };
    },
  };
};
