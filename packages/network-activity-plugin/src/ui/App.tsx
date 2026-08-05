import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { NetworkActivityEventMap } from '../shared/client';

import { InspectorView } from './views/InspectorView';
import { LoadingView } from './views/LoadingView';

import './globals.css';

export default function NetworkActivityPanel() {
  const client = useRozeniteDevToolsClient<NetworkActivityEventMap>({
    pluginId: '@rozenite/network-activity-plugin',
  });

  if (!client) {
    return <LoadingView />;
  }

  return <InspectorView client={client} />;
}
