import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useMemo } from 'react';
import type {
  StorageDeleteEntryEvent,
  StorageDiscoverStoragesRequestEvent,
  StorageEventMap,
  StorageExportSnapshotRequestEvent,
  StorageGetEntryRequestEvent,
  StorageImportEntriesEvent,
  StorageImportPreviewRequestEvent,
  StorageInvalidationOperation,
  StorageListEntryPreviewsRequestEvent,
  StorageSetEntryEvent,
} from '../shared/messaging';
import type { StorageAdapter } from '../shared/types';
import { handleImportEntries, handleImportPreviewRequest } from './import';
import { handleStorageDiscoveryRequest } from './storage-discovery';
import { handleListEntryPreviewsRequest } from './entry-preview-pagination';
import { handleFullEntryRequest } from './full-entry-request';
import { handleExportSnapshotRequest } from './export-snapshot';
import { createStorageViews } from './storage-view';
import { useStorageAgentTools } from './useStorageAgentTools';

export type RozeniteStoragePluginOptions = {
  storages: StorageAdapter[];
};

export const useRozeniteStoragePlugin = ({
  storages,
}: RozeniteStoragePluginOptions) => {
  const views = useMemo(() => createStorageViews(storages), [storages]);

  useStorageAgentTools(views);

  const client = useRozeniteDevToolsClient<StorageEventMap>({
    pluginId: '@rozenite/storage-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const viewSubscriptions: { remove: () => void }[] = [];
    let disposed = false;

    const sendInvalidation = (
      target: StorageSetEntryEvent['target'],
      key?: string,
      operation?: StorageInvalidationOperation,
    ) => {
      client.send('storage-invalidated', {
        type: 'storage-invalidated',
        target,
        key,
        operation,
      });
    };

    // Prevent one storage watcher failure from breaking the whole plugin.
    void Promise.all(
      views
        .filter((view) => view.supportsSubscriptions && view.watch)
        .map(async (view) => {
          try {
            const watch = view.watch;
            if (!watch) {
              return;
            }

            const subscription = await watch((key) => {
              sendInvalidation(view.target, key);
            });

            if (disposed) {
              subscription.remove();
              return;
            }

            viewSubscriptions.push(subscription);
          } catch (error) {
            console.warn(
              `[Rozenite] Storage Plugin: Failed to attach watcher for ${view.target.adapterId}/${view.target.storageId}.`,
              error,
            );
          }
        }),
    );

    const messageSubscriptions = [
      client.onMessage(
        'set-entry',
        async ({ target, entry }: StorageSetEntryEvent) => {
          const view = views.find(
            (candidate) =>
              candidate.target.adapterId === target.adapterId &&
              candidate.target.storageId === target.storageId,
          );

          if (!view) {
            console.warn(
              `[Rozenite] Storage Plugin: Storage target not found for ${target.adapterId}/${target.storageId}`,
            );
            return;
          }

          try {
            await view.set(entry);
            sendInvalidation(view.target, entry.key, 'set');
          } catch (error) {
            console.warn(
              `[Rozenite] Storage Plugin: Failed to set entry in ${target.adapterId}/${target.storageId}.`,
              error,
            );
          }
        },
      ),
      client.onMessage(
        'delete-entry',
        async ({ target, key }: StorageDeleteEntryEvent) => {
          const view = views.find(
            (candidate) =>
              candidate.target.adapterId === target.adapterId &&
              candidate.target.storageId === target.storageId,
          );

          if (!view) {
            console.warn(
              `[Rozenite] Storage Plugin: Storage target not found for ${target.adapterId}/${target.storageId}`,
            );
            return;
          }

          try {
            await view.delete(key);
            sendInvalidation(view.target, key, 'delete');
          } catch (error) {
            console.warn(
              `[Rozenite] Storage Plugin: Failed to delete entry in ${target.adapterId}/${target.storageId}.`,
              error,
            );
          }
        },
      ),
      client.onMessage(
        'discover-storages',
        async (event: StorageDiscoverStoragesRequestEvent) => {
          const response = await handleStorageDiscoveryRequest(views, event);
          client.send(response.type, response);
        },
      ),
      client.onMessage(
        'list-entry-previews',
        async (event: StorageListEntryPreviewsRequestEvent) => {
          const response = await handleListEntryPreviewsRequest(views, event);
          client.send(response.type, response);
        },
      ),
      client.onMessage(
        'get-entry',
        async (event: StorageGetEntryRequestEvent) => {
          const response = await handleFullEntryRequest(views, event);
          client.send(response.type, response);
        },
      ),
      client.onMessage(
        'export-snapshot',
        async (event: StorageExportSnapshotRequestEvent) => {
          const response = await handleExportSnapshotRequest(views, event);
          client.send(response.type, response);
        },
      ),
      client.onMessage(
        'preview-import',
        async (event: StorageImportPreviewRequestEvent) => {
          const response = await handleImportPreviewRequest(views, event);
          client.send(response.type, response);
        },
      ),
      client.onMessage(
        'import-entries',
        async (event: StorageImportEntriesEvent) => {
          await handleImportEntries(views, event, (out) => {
            client.send(out.type, out);
          });
        },
      ),
    ];

    return () => {
      disposed = true;
      viewSubscriptions.forEach((subscription) => subscription.remove());
      messageSubscriptions.forEach((subscription) => subscription.remove());
    };
  }, [client, views]);

  return client;
};
