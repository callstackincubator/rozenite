import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect } from 'react';
import { MMKVEventMap } from '../shared/messaging';
import { getMMKVContainer } from './mmkv-container';
import { getMMKVEntry } from './mmkv-entry';

const mmkvContainer = getMMKVContainer();

export const useMMKVDevTools = () => {
  const client = useRozeniteDevToolsClient<MMKVEventMap>({
    pluginId: '@rozenite/mmkv-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const instanceCreatedSubscription = mmkvContainer.on(
      'instance-created',
      () => {
        client.send('host-instances', mmkvContainer.getInstanceIds());
      }
    );

    const instanceUpdatedSubscription = mmkvContainer.on(
      'value-changed',
      (instanceId, key) => {
        const instance = mmkvContainer.getInstance(instanceId);

        if (!instance) {
          console.warn('MMKV instance not found:', instanceId);
          return;
        }

        client.send('host-entry-updated', {
          instanceId: instanceId,
          key,
          value: instance.getString(key) ?? '',
        });
      }
    );

    return () => {
      instanceCreatedSubscription();
      instanceUpdatedSubscription();
    };
  }, [client]);

  useEffect(() => {
    if (!client) {
      return;
    }

    const getAllEntriesSubscription = client.onMessage(
      'guest-get-entries',
      (event) => {
        const { instanceId } = event;
        const instance = mmkvContainer.getInstance(instanceId);

        if (!instance) {
          console.warn('MMKV instance not found:', instanceId);
          return;
        }

        const entries = instance
          .getAllKeys()
          .map((key) => getMMKVEntry(instance, key));

        client.send('host-entries', {
          instanceId,
          entries,
        });
      }
    );

    const getInstancesSubscription = client.onMessage(
      'guest-get-instances',
      () => {
        client.send('host-instances', mmkvContainer.getInstanceIds());
      }
    );

    const updateEntrySubscription = client.onMessage(
      'guest-update-entry',
      (event) => {
        const { instanceId, key, value } = event;
        const instance = mmkvContainer.getInstance(instanceId);

        if (!instance) {
          console.warn('MMKV instance not found:', instanceId);
          return;
        }

        instance.set(key, value);
      }
    );

    return () => {
      getAllEntriesSubscription.remove();
      getInstancesSubscription.remove();
      updateEntrySubscription.remove();
    };
  }, [client]);

  return client;
};
