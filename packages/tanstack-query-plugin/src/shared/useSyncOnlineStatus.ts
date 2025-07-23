import { useEffect } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { TanStackQueryPluginClient } from './messaging';

export const useSyncOnlineStatus = (
  client: TanStackQueryPluginClient | null
) => {
  useEffect(() => {
    if (!client) {
      return;
    }

    const onlineManagerSubscription = onlineManager.subscribe((online) => {
      // client.send('online-status-changed', { online });
    });

    const onlineMessageSubscription = client.onMessage(
      'online-status-changed',
      ({ online }) => {
        console.log('changed from ', onlineManager.isOnline(), 'to', online);
        // onlineManager.setOnline(online);
      }
    );

    return () => {
      onlineManagerSubscription();
      onlineMessageSubscription.remove();
    };
  }, [client]);
};
