import {
  QueryClient,
  QueryCacheNotifyEvent,
  MutationCacheNotifyEvent,
} from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { TanStackQueryPluginClient } from '../shared/messaging';
import { dehydrateQuery, dehydrateMutation } from '../shared/dehydrate';

export const useSyncTanStackCache = (
  queryClient: QueryClient,
  client: TanStackQueryPluginClient | null
) => {
  const handler = useMemo(() => {
    return (event: QueryCacheNotifyEvent | MutationCacheNotifyEvent): void => {
      if (!client) {
        return;
      }

      if (event.type === 'observerResultsUpdated') {
        // We don't need to sync this type of events.
        return;
      }

      if ('query' in event) {
        const { query, type } = event;
        const dehydratedQuery = dehydrateQuery(query);
        client.send('sync-query-event', { type, data: dehydratedQuery });
        return;
      }

      const { mutation, type } = event;
      if (mutation) {
        const dehydratedMutation = dehydrateMutation(mutation);
        client.send('sync-mutation-event', {
          type,
          data: dehydratedMutation,
        });
      }
    };
  }, [client]);

  useEffect(() => {
    if (!client) {
      return;
    }

    const mutationCacheSubscription = queryClient
      .getMutationCache()
      .subscribe(handler);
    const queryCacheSubscription = queryClient
      .getQueryCache()
      .subscribe(handler);

    return () => {
      mutationCacheSubscription();
      queryCacheSubscription();
    };
  }, [client, queryClient, handler]);
};
