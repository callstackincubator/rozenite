import { useState, useEffect } from 'react';
import { RozeniteSharedStorage } from './shared-storage';

const useSynchronizedRozeniteSharedStorage = <T extends Record<string, unknown>>(
  storage: RozeniteSharedStorage<T>
): T | null => {
  const [data, setData] = useState<T | null>(() => {
    if (storage.isSynchronized()) {
      return storage.getSnapshot();
    }
    return null;
  });

  useEffect(() => {
    if (storage.isSynchronized()) {
      // It's possible it synced between init and effect
      setData((prev) => {
        // Optimization: don't update if already set (though reference comparison might fail if snapshot is new)
        if (prev === null) return storage.getSnapshot();
        return prev;
      });
    }

    return storage.subscribe((newData) => {
      if (storage.isSynchronized()) {
        setData({ ...newData });
      } else {
        setData(null);
      }
    });
  }, [storage]);

  return data;
};

const useUnsynchronizedRozeniteSharedStorage = <T extends Record<string, unknown>>(
  storage: RozeniteSharedStorage<T>
): T => {
  const [data, setData] = useState<T>(() => storage.getSnapshot());

  useEffect(() => {
    // In case storage ref changed or just to ensure freshness (though usually storage instance is stable)
    setData(storage.getSnapshot());

    return storage.subscribe((newData) => {
      setData({ ...newData });
    });
  }, [storage]);

  return data;
};

export type UseRozeniteSharedStorageOptions<TEnsureSynchronized extends boolean = boolean> = {
  ensureSynchronized?: TEnsureSynchronized;
};

export function useRozeniteSharedStorage<T extends Record<string, unknown>>(
  storage: RozeniteSharedStorage<T>,
  options: UseRozeniteSharedStorageOptions<true>
): T | null;

export function useRozeniteSharedStorage<T extends Record<string, unknown>>(
  storage: RozeniteSharedStorage<T>,
  options?: UseRozeniteSharedStorageOptions<false>
): T;

export function useRozeniteSharedStorage<T extends Record<string, unknown>>(
  storage: RozeniteSharedStorage<T>,
  options?: UseRozeniteSharedStorageOptions
): T | null {
  // Freeze the option on first render to prevent hook switching at runtime
  const [ensureSynchronized] = useState(
    () => options?.ensureSynchronized ?? false
  );

  if (ensureSynchronized) {
    return useSynchronizedRozeniteSharedStorage(storage);
  }

  return useUnsynchronizedRozeniteSharedStorage(storage);
}
