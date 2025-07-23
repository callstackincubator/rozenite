import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools/production';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { TanStackQueryPluginEventMap } from '../shared/messaging';
import { useSyncInitialData } from './useSyncInitialData';
import { useSyncDevToolsEvents } from './useSyncDevToolsEvents';
import { useSyncOnlineStatus } from '../shared/useSyncOnlineStatus';
import { useHandleSyncMessages } from './useHandleSyncMessages';

const App = () => {
  const client = useRozeniteDevToolsClient<TanStackQueryPluginEventMap>({
    pluginId: '@rozenite/tanstack-query-plugin',
  });

  useSyncInitialData(client);

  useSyncDevToolsEvents(client);

  useSyncOnlineStatus(client);

  useHandleSyncMessages(client);

  return <ReactQueryDevtoolsPanel />;
};

const queryClient = new QueryClient();

export default function TanStackQueryPanel() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}
