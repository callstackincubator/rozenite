import { useEffect } from 'react';
import { TanStackQueryPluginClient } from '../shared/messaging';
import { useQueryClient } from '@tanstack/react-query';
import {
  hydrateQueryClient,
  applyQueryEvent,
  applyMutationEvent,
  applyQueryObserverEvent,
} from '../shared/hydrate';

export const useHandleSyncMessages = (
  client: TanStackQueryPluginClient | null
) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!client) {
      return;
    }

    const querySubscription = client.onMessage(
      'sync-query-event',
      (message) => {
        const { type, data } = message;

        if (type === 'added' || type === 'removed') {
          applyQueryEvent(queryClient, type, data);
          return;
        }

        if (type === 'updated') {
          const action = 'action' in message ? message.action : undefined;
          applyQueryEvent(queryClient, type, data, action);
          return;
        }

        if (
          type === 'observerAdded' ||
          type === 'observerRemoved' ||
          type === 'observerOptionsUpdated'
        ) {
          applyQueryObserverEvent(queryClient, data);
          return;
        }
      }
    );

    const mutationSubscription = client.onMessage(
      'sync-mutation-event',
      ({ type, data }) => {
        applyMutationEvent(queryClient, type, data);
      }
    );

    // Keep the full sync for initial data requests
    const fullSyncSubscription = client.onMessage('sync-data', ({ data }) => {
      hydrateQueryClient(queryClient, data);
    });

    return () => {
      querySubscription.remove();
      mutationSubscription.remove();
      fullSyncSubscription.remove();
    };
  }, [client, queryClient]);
};
