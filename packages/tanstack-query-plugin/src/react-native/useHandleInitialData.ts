import { useEffect } from 'react';
import { TanStackQueryPluginClient } from '../shared/messaging';
import { useQueryClient } from '@tanstack/react-query';
import { dehydrateQueryClient } from '../shared/dehydrate';

export const useHandleInitialData = (
  client: TanStackQueryPluginClient | null
) => {
  const queryClient = useQueryClient();

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
