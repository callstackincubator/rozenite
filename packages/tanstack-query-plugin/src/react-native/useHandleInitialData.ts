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

    // This hook runs last in `useTanStackQueryDevTools`, so by the time the
    // panel reacts to this every handler is listening. The panel is recreated on
    // every app reload and asks for the cache as soon as it boots, which usually
    // beats the app's React tree to the punch; without this its only request is
    // dropped and the panel stays empty until the app is restarted.
    client.send('device-ready', {});

    return () => {
      subscription.remove();
    };
  }, [client, queryClient]);
};
