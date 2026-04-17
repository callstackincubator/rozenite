import { useEffect } from 'react';
import type { NetworkInspector } from './network-inspector';
import type { NetworkActivityDevToolsClient } from '../shared/client';
import { getOverridesRegistry } from './http/overrides-registry';

const overridesRegistry = getOverridesRegistry();

export const useHttpInspector = (
  client: NetworkActivityDevToolsClient | null,
  networkInspector: NetworkInspector,
  isEnabled: boolean,
  isRecordingEnabled: boolean,
) => {
  useEffect(() => {
    if (!client || !isEnabled) {
      return;
    }

    const subscriptions = [
      client.onMessage('network-enable', () => {
        networkInspector.http.enable();
      }),
      client.onMessage('network-disable', () => {
        networkInspector.http.disable();
      }),
      client.onMessage('set-overrides', (data) => {
        overridesRegistry.setOverrides(data.overrides);
      }),
      client.onMessage('get-response-body', async ({ requestId }) => {
        const body = await networkInspector.getResponseBody(requestId);

        client.send('response-body', {
          requestId,
          body,
        });
      }),
    ];

    // If recording was previously enabled, enable the inspector (hot reload)
    if (isRecordingEnabled) {
      networkInspector.http.enable();
    }

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      networkInspector.http.dispose();
    };
  }, [client, networkInspector, isEnabled, isRecordingEnabled]);
};
