import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useMemo } from 'react';
import type {
  StorageDeleteEntryEvent,
  StorageEventMap,
  StorageGetSnapshotEvent,
  StorageSetEntryEvent,
} from '../shared/messaging';
import type { StorageAdapter } from '../shared/types';
import { createStorageViews } from './storage-view';

export type RozeniteStoragePluginOptions = {
  storages: StorageAdapter[];
};

export const useRozeniteStoragePlugin = ({
  storages,
}: RozeniteStoragePluginOptions) => {
  const views = useMemo(() => createStorageViews(storages), [storages]);

  const client = useRozeniteDevToolsClient<StorageEventMap>({
    pluginId: '@rozenite/storage-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const pushSnapshot = async (viewId?: string) => {
      const selectedViews = viewId ? views.filter((view) => view.id === viewId) : views;

      for (const view of selectedViews) {
        try {
          const entries = await view.getAllEntries();
          client.send('snapshot', {
            type: 'snapshot',
            target: view.target,
            adapterName: view.adapterName,
            storageName: view.storageName,
            capabilities: view.capabilities,
            entries,
          });
        } catch (error) {
          console.warn(
            `[Rozenite] Storage Plugin: Failed to snapshot ${view.target.adapterId}/${view.target.storageId}.`,
            error
          );
        }
      }
    };

    void pushSnapshot();

    const viewSubscriptions: { remove: () => void }[] = [];
    let disposed = false;

    // Prevent one storage watcher failure from breaking the whole plugin.
    void Promise.all(
      views.map(async (view) => {
        try {
          const subscription = await view.watch({
            onSet: (entry) => {
              client.send('set-entry', {
                type: 'set-entry',
                target: view.target,
                entry,
              });
            },
            onDelete: (key) => {
              client.send('delete-entry', {
                type: 'delete-entry',
                target: view.target,
                key,
              });
            },
          });

          if (disposed) {
            subscription.remove();
            return;
          }

          viewSubscriptions.push(subscription);
        } catch (error) {
          console.warn(
            `[Rozenite] Storage Plugin: Failed to attach watcher for ${view.target.adapterId}/${view.target.storageId}.`,
            error
          );
        }
      })
    );

    const messageSubscriptions = [
      client.onMessage('set-entry', async ({ target, entry }: StorageSetEntryEvent) => {
        const view = views.find(
          (candidate) =>
            candidate.target.adapterId === target.adapterId &&
            candidate.target.storageId === target.storageId
        );

        if (!view) {
          console.warn(
            `[Rozenite] Storage Plugin: Storage target not found for ${target.adapterId}/${target.storageId}`
          );
          return;
        }

        try {
          await view.set(entry);
        } catch (error) {
          console.warn(
            `[Rozenite] Storage Plugin: Failed to set entry in ${target.adapterId}/${target.storageId}.`,
            error
          );
        }
      }),
      client.onMessage(
        'delete-entry',
        async ({ target, key }: StorageDeleteEntryEvent) => {
          const view = views.find(
            (candidate) =>
              candidate.target.adapterId === target.adapterId &&
              candidate.target.storageId === target.storageId
          );

          if (!view) {
            console.warn(
              `[Rozenite] Storage Plugin: Storage target not found for ${target.adapterId}/${target.storageId}`
            );
            return;
          }

          try {
            await view.delete(key);
          } catch (error) {
            console.warn(
              `[Rozenite] Storage Plugin: Failed to delete entry in ${target.adapterId}/${target.storageId}.`,
              error
            );
          }
        }
      ),
      client.onMessage('get-snapshot', async ({ target }: StorageGetSnapshotEvent) => {
        if (target === 'all') {
          await pushSnapshot();
          return;
        }

        await pushSnapshot(`${target.adapterId}:${target.storageId}`);
      }),
    ];

    return () => {
      disposed = true;
      viewSubscriptions.forEach((subscription) => subscription.remove());
      messageSubscriptions.forEach((subscription) => subscription.remove());
    };
  }, [client, views]);

  return client;
};
