import { useEffect } from 'react';
import { TanStackQueryPluginClient } from '../shared/messaging';
import { useQueryClient } from '@tanstack/react-query';
import { hydrateQueryClient } from '../shared/hydrate';

export const useHandleSyncMessages = (
  client: TanStackQueryPluginClient | null
) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!client) {
      return;
    }

    const subscription = client.onMessage('sync-data', ({ data }) => {
      hydrateQueryClient(queryClient, data);
    });

    return () => {
      subscription.remove();
    };
  }, [client, queryClient]);
};
