import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { TanStackQueryPluginClient } from '../shared/messaging';
import { dehydrateQueryClient } from '../shared/dehydrate';

export const useSyncTanStackCache = (
  client: TanStackQueryPluginClient | null
) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!client) {
      return;
    }

    const handler = (): void => {
      const dehydratedState = dehydrateQueryClient(queryClient);
      client.send('sync-data', { data: dehydratedState });
    };

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
  }, [client, queryClient]);
};
