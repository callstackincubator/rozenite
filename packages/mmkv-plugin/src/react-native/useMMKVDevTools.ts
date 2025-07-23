import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import { useEffect } from "react";
import { MMKV } from "react-native-mmkv";
import { MMKVEventMap } from "../shared/network";
import { createNanoEvents } from "nanoevents";

type NanoEventsMap<T extends MMKVEventMap = MMKVEventMap> = { [k in keyof T]: (event: T[k]) => void };
const eventEmitter = createNanoEvents<NanoEventsMap>();
const instances: string[] = [];
const instanceMap = new Map<string, MMKV>();

export const useMMKVDevTools = () => {
  const client = useRozeniteDevToolsClient<MMKVEventMap>({
    pluginId: '@rozenite/mmkv-plugin',
  });

  useEffect(() => {
    Object.defineProperty(MMKV.prototype, 'nativeInstance', {
      get() {
        return this._nativeInstance;
      },
      set(value) {
        instances.push(this.id);
        instanceMap.set(this.id, this);
        this._nativeInstance = value;
      }
    });
  }, []);

  useEffect(() => {
    if (!client) {
      return;
    }

    return eventEmitter.on('add-instance', (event) => {
      client.send('add-instance', event);
    });
  }, [client]);

  useEffect(() => {
    if (!client) {
      return;
    }

    const subscription = client.onMessage('get-instances', () => {
      console.log('get-instances', instances);
      client.send('instances', instances);
    });

    return () => {
      subscription.remove();
    };
  }, [client]);

  useEffect(() => {
    if (!client) {
      return;
    }

    const subscription = client.onMessage('get-entries', (event) => {
      const { instanceId } = event;
      const instance = instanceMap.get(instanceId);
      
      if (!instance) {
        console.warn('MMKV instance not found:', instanceId);
        return;
      }

      try {
        const allKeys = instance.getAllKeys();
        const entries = allKeys.map(key => {
          let type: 'string' | 'number' | 'boolean' | 'buffer' = 'string';
          let value: any = null;

          // Try to get value with different types
          if (instance.contains(key)) {
            // Try string first
            const stringValue = instance.getString(key);
            if (stringValue !== undefined) {
              type = 'string';
              value = stringValue;
            } else {
              // Try number
              const numberValue = instance.getNumber(key);
              if (numberValue !== undefined) {
                type = 'number';
                value = numberValue;
              } else {
                // Try boolean
                const booleanValue = instance.getBoolean(key);
                if (booleanValue !== undefined) {
                  type = 'boolean';
                  value = booleanValue;
                } else {
                  // Try buffer
                  const bufferValue = instance.getBuffer(key);
                  if (bufferValue !== undefined) {
                    type = 'buffer';
                    value = 'Buffer'
                  }
                }
              }
            }
          }

          return {
            key,
            type,
            value,
          }
        });

        client.send('entries', {
          instanceId,
          entries
        });
      } catch (error) {
        console.error('Error getting MMKV entries:', error);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [client]);

  return client;
};