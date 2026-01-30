import { RozeniteDevToolsClient } from '../client';

const isPanel =
  typeof window !== 'undefined' && '__ROZENITE_PANEL__' in window;

export type RozeniteSharedStorageEventMap<T> = {
  'rozenite-storage-init': { defaults: T };
  'rozenite-storage-sync': { data: T };
  'rozenite-storage-update': { key: keyof T; value: T[keyof T] };
};

export type RozeniteSharedStorage<T> = {
  connect: (
    client: RozeniteDevToolsClient<RozeniteSharedStorageEventMap<T>>
  ) => void;
  get: <K extends keyof T>(key: K) => T[K];
  set: <K extends keyof T>(key: K, value: T[K]) => void;
  getSnapshot: () => T;
  subscribe: (listener: (data: T) => void) => () => void;
  isSynchronized: () => boolean;
};

const createHostStorage = <T extends Record<string, unknown>>(
  pluginId: string,
  defaults: T
): RozeniteSharedStorage<T> => {
  let data: T = { ...defaults };
  const listeners = new Set<(data: T) => void>();
  let client: RozeniteDevToolsClient<
    RozeniteSharedStorageEventMap<T>
  > | null = null;

  const loadFromPersistence = () => {
    try {
      const stored = localStorage.getItem(`rozenite-storage-${pluginId}`);
      if (stored) {
        data = { ...defaults, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to load storage', e);
    }
  };

  const saveToPersistence = () => {
    try {
      localStorage.setItem(
        `rozenite-storage-${pluginId}`,
        JSON.stringify(data)
      );
    } catch (e) {
      console.error('Failed to save storage', e);
    }
  };

  const notifyListeners = () => {
    listeners.forEach((listener) => listener(data));
  };

  const handleInit = (deviceDefaults: T) => {
    let hasData = false;
    try {
      const stored = localStorage.getItem(`rozenite-storage-${pluginId}`);
      if (stored) {
        hasData = true;
      }
    } catch {
      // ignore
    }

    if (!hasData) {
      // Adopt defaults
      data = { ...deviceDefaults };
      saveToPersistence();
    }

    // Send Sync
    client?.send('rozenite-storage-sync', { data: data });
  };

  loadFromPersistence();

  return {
    connect: (newClient) => {
      client = newClient;
      client.onMessage(
        'rozenite-storage-init',
        (payload: { defaults: T }) => {
          handleInit(payload.defaults);
        }
      );
    },

    get: <K extends keyof T>(key: K): T[K] => {
      return data[key];
    },

    getSnapshot: (): T => {
      return data;
    },

    set: <K extends keyof T>(key: K, value: T[K]) => {
      data[key] = value;
      notifyListeners();
      saveToPersistence();
      client?.send('rozenite-storage-update', { key, value });
    },

    subscribe: (listener: (data: T) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    isSynchronized: () => true,
  };
};

const createDeviceStorage = <T extends Record<string, unknown>>(
  defaults: T
): RozeniteSharedStorage<T> => {
  let data: T = { ...defaults };
  const listeners = new Set<(data: T) => void>();
  let client: RozeniteDevToolsClient<
    RozeniteSharedStorageEventMap<T>
  > | null = null;
  let synchronized = false;

  const notifyListeners = () => {
    listeners.forEach((listener) => listener(data));
  };

  const handleSync = (newData: T) => {
    data = { ...newData };
    synchronized = true;
    notifyListeners();
  };

  const handleUpdate = <K extends keyof T>(key: K, value: T[K]) => {
    data[key] = value;
    notifyListeners();
  };

  return {
    connect: (newClient) => {
      client = newClient;

      client.onMessage('rozenite-storage-sync', (payload: { data: T }) => {
        handleSync(payload.data);
      });

      client.onMessage(
        'rozenite-storage-update',
        (payload: { key: keyof T; value: T[keyof T] }) => {
          handleUpdate(payload.key, payload.value);
        }
      );

      // Send Init
      client.send('rozenite-storage-init', { defaults });
    },

    get: <K extends keyof T>(key: K): T[K] => {
      return data[key];
    },

    getSnapshot: (): T => {
      return data;
    },

    set: <K extends keyof T>(key: K, value: T[K]) => {
      data[key] = value;
      notifyListeners();
      // Device logic: only update local, do not sync back to host for now
    },

    subscribe: (listener: (data: T) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    isSynchronized: () => synchronized,
  };
};

export const createRozeniteSharedStorage = <T extends Record<string, unknown>>(
  pluginId: string,
  defaults: T
): RozeniteSharedStorage<T> => {
  if (isPanel) {
    return createHostStorage(pluginId, defaults);
  }
  
  return createDeviceStorage(defaults);
};
