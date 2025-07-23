import { useEffect } from 'react';
import { TanStackQueryPluginClient } from '../shared/messaging';

export const useSyncInitialData = (
  client: TanStackQueryPluginClient | null
) => {
  useEffect(() => {
    if (!client) {
      return;
    }

    client.send('request-initial-data', {});
  }, [client]);
};
