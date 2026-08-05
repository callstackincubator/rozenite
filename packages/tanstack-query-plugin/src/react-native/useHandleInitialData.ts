import { useEffect } from 'react';
import { TanStackQueryPluginClient } from '../shared/messaging';
import { QueryClient } from '@tanstack/react-query';
import { dehydrateQueryClient } from '../shared/dehydrate';

export const useHandleInitialData = (
  queryClient: QueryClient,
  client: TanStackQueryPluginClient | null,
) => {
  useEffect(() => {
    if (!client) {
      return;
    }

    const subscription = client.onMessage('request-initial-data', () => {
      const dehydratedState = dehydrateQueryClient(queryClient);
      client.send('sync-data', { data: dehydratedState });
    });

    return () => {
      subscription.remove();
    };
  }, [client, queryClient]);
};
