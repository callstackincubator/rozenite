// Define a simple event emitter since we can't use nanoevents
type Unsubscribe = () => void;
type Callback = (...args: unknown[]) => void;

// Simple event emitter implementation
function createEventEmitter<T extends Record<string, unknown>>() {
  const events = new Map<keyof T, Callback[]>();
  
  return {
    on<K extends keyof T>(event: K, callback: Callback): Unsubscribe {
      if (!events.has(event)) {
        events.set(event, []);
      }
      
      const callbacks = events.get(event);
      if (callbacks) {
        callbacks.push(callback);
      }
      
      return () => {
        const callbackList = events.get(event);
        if (callbackList) {
          const index = callbackList.indexOf(callback);
          if (index !== -1) {
            callbackList.splice(index, 1);
          }
        }
      };
    },
    
    emit<K extends keyof T>(event: K, ...args: unknown[]): void {
      const callbacks = events.get(event);
      if (callbacks) {
        [...callbacks].forEach(callback => callback(...args));
      }
    }
  };
}

import { AsyncStorageEntry } from '../shared/types';

export type AsyncStorageContainerEvents = {
  'value-changed': (key: string, value: string) => void;
  'value-removed': (key: string) => void;
  'storage-cleared': () => void;
};

export type AsyncStorageAPI = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  getAllKeys: () => Promise<readonly string[]>;
  multiGet: (keys: readonly string[]) => Promise<readonly [string, string | null][]>;
  clear: () => Promise<void>;
};

export type AsyncStorageContainer = {
  getAllKeys: () => Promise<string[]>;
  getEntries: (keys?: string[]) => Promise<AsyncStorageEntry[]>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  clear: () => Promise<void>;
  on: <T extends keyof AsyncStorageContainerEvents>(
    event: T,
    listener: AsyncStorageContainerEvents[T]
  ) => Unsubscribe;
};

// Detect and parse the value into a specific type
const detectValueType = (value: string): {type: AsyncStorageEntry['type']; parsedValue?: unknown} => {
  if (value === null || value === undefined) {
    return { type: 'null' };
  }
  
  try {
    // Try to parse JSON
    const parsed = JSON.parse(value);
    
    if (parsed === null) {
      return { type: 'null', parsedValue: null };
    }
    
    if (Array.isArray(parsed)) {
      return { type: 'array', parsedValue: parsed };
    }
    
    if (typeof parsed === 'object') {
      return { type: 'object', parsedValue: parsed };
    }
    
    if (typeof parsed === 'number') {
      return { type: 'number', parsedValue: parsed };
    }
    
    if (typeof parsed === 'boolean') {
      return { type: 'boolean', parsedValue: parsed };
    }
    
    return { type: 'string', parsedValue: parsed };
  } catch {
    // If JSON parsing fails, it's a plain string
    return { type: 'string', parsedValue: value };
  }
};

export const getAsyncStorageContainer = (
  asyncStorage: AsyncStorageAPI
): AsyncStorageContainer => {
  const eventEmitter = createEventEmitter<AsyncStorageContainerEvents>();

  // Override setItem to emit events when values change
  const originalSetItem = asyncStorage.setItem;
  asyncStorage.setItem = async (key: string, value: string) => {
    await originalSetItem.call(asyncStorage, key, value);
    eventEmitter.emit('value-changed', key, value);
  };

  // Override removeItem to emit events when values are removed
  const originalRemoveItem = asyncStorage.removeItem;
  asyncStorage.removeItem = async (key: string) => {
    await originalRemoveItem.call(asyncStorage, key);
    eventEmitter.emit('value-removed', key);
  };

  // Override clear to emit events when storage is cleared
  const originalClear = asyncStorage.clear;
  asyncStorage.clear = async () => {
    await originalClear.call(asyncStorage);
    eventEmitter.emit('storage-cleared');
  };

  return {
    getAllKeys: async () => {
      try {
        const keys = await asyncStorage.getAllKeys();
        // Convert readonly string[] to string[]
        return [...keys];
      } catch (error) {
        console.error('AsyncStorage getAllKeys error:', error);
        return [];
      }
    },

    getEntries: async (keys?: string[]) => {
      try {
        let keysToGet: readonly string[];
        
        if (!keys || keys.length === 0) {
          keysToGet = await asyncStorage.getAllKeys();
        } else {
          keysToGet = keys;
        }
        
        const entriesPairs = await asyncStorage.multiGet(keysToGet);
        
        return entriesPairs
          .filter((pair): pair is [string, string] => pair[1] !== null)
          .map(([key, value]) => {
            const { type, parsedValue } = detectValueType(value);
            return {
              key,
              value,
              type,
              parsedValue
            };
          });
      } catch (error) {
        console.error('AsyncStorage getEntries error:', error);
        return [];
      }
    },

    setItem: async (key: string, value: string) => {
      try {
        await asyncStorage.setItem(key, value);
      } catch (error) {
        console.error('AsyncStorage setItem error:', error);
        throw error;
      }
    },

    removeItem: async (key: string) => {
      try {
        await asyncStorage.removeItem(key);
      } catch (error) {
        console.error('AsyncStorage removeItem error:', error);
        throw error;
      }
    },

    clear: async () => {
      try {
        await asyncStorage.clear();
      } catch (error) {
        console.error('AsyncStorage clear error:', error);
        throw error;
      }
    },

    on: (event, listener) => {
      return eventEmitter.on(event, listener as Callback);
    },
  };
};