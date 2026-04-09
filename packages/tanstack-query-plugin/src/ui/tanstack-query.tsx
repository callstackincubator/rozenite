import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools/production';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { TanStackQueryPluginEventMap } from '../shared/messaging';
import { useSyncInitialData } from './useSyncInitialData';
import { useSyncDevToolsEvents } from './useSyncDevToolsEvents';
import { useSyncOnlineStatus } from '../shared/useSyncOnlineStatus';
import { useHandleSyncMessages } from './useHandleSyncMessages';
import { instrumentQueryClient } from '../shared/query-data-sync';

const App = () => {
  const client = useRozeniteDevToolsClient<TanStackQueryPluginEventMap>({
    pluginId: '@rozenite/tanstack-query-plugin',
  });

  useEffect(() => {
    instrumentQueryClient(queryClient, ({ queryHash, data }) => {
      client?.send('devtools-action', {
        type: 'SET_QUERY_DATA',
        queryHash,
        metadata: { data },
      });
    });
  }, [client]);

  useSyncInitialData(client);

  useSyncDevToolsEvents(client);

  useSyncOnlineStatus(client);

  useHandleSyncMessages(client);

  return <ReactQueryDevtoolsPanel style={{ height: '100%', width: '100%' }} />;
};

const queryClient = new QueryClient();

export default function TanStackQueryPanel() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}
