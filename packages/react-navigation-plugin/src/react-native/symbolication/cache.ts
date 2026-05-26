// A tiny LRU keyed on raw stack strings. Apps typically dispatch
// navigation from a small set of callsites, so capacity is generous —
// 256 entries holds the dispatch fingerprints of a wildly diverse app.
const DEFAULT_CAPACITY = 256;

export type SymbolicationCache<V> = {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  size(): number;
  clear(): void;
};

export const createSymbolicationCache = <V>(
  capacity: number = DEFAULT_CAPACITY,
): SymbolicationCache<V> => {
  // Map preserves insertion order — deleting + re-inserting on hit is
  // enough to maintain LRU recency without a separate linked list.
  const entries = new Map<string, V>();

  return {
    get(key) {
      if (!entries.has(key)) return undefined;
      const value = entries.get(key) as V;
      // Bump recency by re-inserting.
      entries.delete(key);
      entries.set(key, value);
      return value;
    },
    set(key, value) {
      if (entries.has(key)) {
        entries.delete(key);
      } else if (entries.size >= capacity) {
        // Evict the oldest entry (first key in insertion order).
        const oldestKey = entries.keys().next().value;
        if (oldestKey !== undefined) {
          entries.delete(oldestKey);
        }
      }
      entries.set(key, value);
    },
    size() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
  };
};
