import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TanStackQueryPluginClient } from '../shared/messaging';

export const useSyncInitialData = (client: TanStackQueryPluginClient | null) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!client) {
      return;
    }

    // The device announces itself once it is listening. It reconnects on every
    // app reload, so the cache has to be pulled again — what the panel holds
    // belongs to the previous JS context.
    const subscription = client.onMessage('device-ready', () => {
      queryClient.clear();
      client.send('request-initial-data', {});
    });

    client.send('request-initial-data', {});

    return () => {
      subscription.remove();
    };
  }, [client, queryClient]);
};
