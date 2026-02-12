import { QueryClient } from '@tanstack/react-query';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { TanStackQueryPluginEventMap } from '../shared/messaging';
import { useSyncOnlineStatus } from '../shared/useSyncOnlineStatus';
import { useHandleDevToolsMessages } from './useHandleDevToolsMessages';
import { useSyncTanStackCache } from './useSyncTanStackCache';
import { useHandleInitialData } from './useHandleInitialData';

export const useTanStackQueryDevTools = (queryClient: QueryClient) => {
  const client = useRozeniteDevToolsClient<TanStackQueryPluginEventMap>({
    pluginId: '@rozenite/tanstack-query-plugin',
  });

  useSyncOnlineStatus(client);

  useHandleDevToolsMessages(queryClient, client);

  useSyncTanStackCache(queryClient, client);

  useHandleInitialData(queryClient, client);
};
