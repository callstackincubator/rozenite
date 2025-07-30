import { useEffect } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { getNetworkInspector } from './network-inspector';
import { NetworkActivityEventMap } from '../shared/client';

export const useNetworkActivityDevTools = () => {
  const client = useRozeniteDevToolsClient<NetworkActivityEventMap>({
    pluginId: '@rozenite/network-activity-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const networkInspector = getNetworkInspector(client);

    return () => {
      networkInspector.dispose();
    };
  }, [client]);

  return client;
};
