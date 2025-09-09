import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect } from 'react';
import { AsyncStorageEventMap } from '../shared/messaging';
import { getAsyncStorageContainer, AsyncStorageAPI } from './async-storage-container';

// Accept AsyncStorage instance as a parameter
export const useAsyncStorageDevTools = (
  asyncStorageInstance: AsyncStorageAPI
) => {
  const client = useRozeniteDevToolsClient<AsyncStorageEventMap>({
    pluginId: '@rozenite/async-storage-plugin',
  });

  useEffect(() => {
    if (!client || !asyncStorageInstance) {
      return;
    }

    const container = getAsyncStorageContainer(asyncStorageInstance);

    // Setup event listeners for changes in AsyncStorage
    const valueChangedSubscription = container.on('value-changed', async (key, value) => {
      // When a value changes, notify the DevTools panel
      client.send('host-entry-updated', { key, value });
      
      // Also update all keys list
      const allKeys = await container.getAllKeys();
      client.send('host-all-keys', allKeys);
    });

    const valueRemovedSubscription = container.on('value-removed', async () => {
      // When a value is removed, update the keys list
      const allKeys = await container.getAllKeys();
      client.send('host-all-keys', allKeys);
    });

    const storageClearedSubscription = container.on('storage-cleared', async () => {
      // When storage is cleared, update the keys list
      const allKeys = await container.getAllKeys();
      client.send('host-all-keys', allKeys);
    });

    // Handle DevTools panel requests
    const getAllKeysSubscription = client.onMessage('guest-get-all-keys', async () => {
      const allKeys = await container.getAllKeys();
      client.send('host-all-keys', allKeys);
    });

    const getEntriesSubscription = client.onMessage('guest-get-entries', async (event) => {
      const entries = await container.getEntries(event.keys);
      client.send('host-entries', entries);
    });

    const updateEntrySubscription = client.onMessage('guest-update-entry', async (event) => {
      await container.setItem(event.key, event.value);
      // The value-changed subscription will handle notifying DevTools
    });

    const removeEntrySubscription = client.onMessage('guest-remove-entry', async (event) => {
      await container.removeItem(event.key);
      // The value-removed subscription will handle notifying DevTools
    });

    const clearAllSubscription = client.onMessage('guest-clear-all', async () => {
      await container.clear();
      // The storage-cleared subscription will handle notifying DevTools
    });

    // Send initial keys list
    container.getAllKeys().then((keys) => {
      client.send('host-all-keys', keys);
    });

    // Cleanup function
    return () => {
      valueChangedSubscription();
      valueRemovedSubscription();
      storageClearedSubscription();
      getAllKeysSubscription.remove();
      getEntriesSubscription.remove();
      updateEntrySubscription.remove();
      removeEntrySubscription.remove();
      clearAllSubscription.remove();
    };
  }, [client, asyncStorageInstance]);

  return client;
};
