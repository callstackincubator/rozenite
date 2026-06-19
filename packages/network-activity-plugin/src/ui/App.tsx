import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { PluginHeader, PluginTheme } from '@rozenite/ui';
import { NetworkActivityEventMap } from '../shared/client';

import { InspectorView } from './views/InspectorView';

import './globals.css';

export default function NetworkActivityPanel() {
  const client = useRozeniteDevToolsClient<NetworkActivityEventMap>({
    pluginId: '@rozenite/network-activity-plugin',
  });

  return (
    <PluginTheme
      className="flex h-screen flex-col bg-background text-foreground"
      defaultTheme="dark"
      storageKey="@rozenite/network-activity-plugin.theme"
    >
      <PluginHeader title="Network Activity" subtitle="Inspect HTTP, WebSocket, and SSE requests." />
      <InspectorView client={client} />
    </PluginTheme>
  );
}
