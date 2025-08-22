import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect } from 'react';
import type { MMKV } from 'react-native-mmkv';
import { MMKVEventMap } from '../shared/messaging';
import { getMMKVView } from './mmkv-view';

export type MMKVDevToolsOptions = {
  /**
   * The MMKV instances to monitor.
   */
  storages: MMKV[];

  /**
   * Optional RegExp to blacklist properties from being shown in DevTools.
   * The pattern is matched against storageId:key format.
   */
  blacklist?: RegExp;
};

export const useMMKVDevTools = ({
  storages,
  blacklist,
}: MMKVDevToolsOptions) => {
  const client = useRozeniteDevToolsClient<MMKVEventMap>({
    pluginId: '@rozenite/mmkv-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const views = storages.map((storage) => getMMKVView(storage, blacklist));

    views.forEach((view) => {
      client.send('snapshot', {
        type: 'snapshot',
        id: view.getId(),
        entries: view.getAllEntries(),
      });
    });

    const subscriptions = [
      ...views.map((view) => {
        return view.onChange((key) => {
          const entry = view.get(key);

          if (!entry) {
            client.send('delete-entry', {
              type: 'delete-entry',
              id: view.getId(),
              key,
            });

            return;
          }

          client.send('set-entry', {
            type: 'set-entry',
            id: view.getId(),
            entry,
          });
        });
      }),
      client.onMessage('set-entry', ({ id, entry }) => {
        const view = views.find((view) => view.getId() === id);

        if (!view) {
          console.warn('MMKV view not found:', entry.key);
          return;
        }

        view.set(entry.key, entry.value);
      }),
      client.onMessage('delete-entry', ({ id, key }) => {
        const view = views.find((view) => view.getId() === id);

        if (!view) {
          console.warn('MMKV view not found:', key);
          return;
        }

        view.delete(key);
      }),
      client.onMessage('get-snapshot', ({ id }) => {
        if (id === 'all') {
          views.forEach((view) => {
            client.send('snapshot', {
              type: 'snapshot',
              id: view.getId(),
              entries: view.getAllEntries(),
            });
          });

          return;
        }

        const view = views.find((view) => view.getId() === id);

        if (!view) {
          console.warn('MMKV view not found:', id);
          return;
        }

        client.send('snapshot', {
          type: 'snapshot',
          id: view.getId(),
          entries: view.getAllEntries(),
        });
      }),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [client, storages, blacklist]);

  return client;
};
