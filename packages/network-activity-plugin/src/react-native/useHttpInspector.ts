import { useEffect } from 'react';
import type { HTTPInspector } from './http/http-inspector';
import type { NetworkActivityDevToolsClient } from '../shared/client';
import { getResponseBody } from './http/http-utils';
import { getOverridesRegistry } from './http/overrides-registry';

const overridesRegistry = getOverridesRegistry();

export const useHttpInspector = (
  client: NetworkActivityDevToolsClient | null,
  httpInspector: HTTPInspector,
  isEnabled: boolean,
  isRecordingEnabled: boolean
) => {
  useEffect(() => {
    if (!client || !isEnabled) {
      return;
    }

    const networkRequestsRegistry =
      httpInspector.getNetworkRequestsRegistry();

    const subscriptions = [
      client.onMessage('network-enable', () => {
        httpInspector.enable();
      }),
      client.onMessage('network-disable', () => {
        httpInspector.disable();
      }),
      client.onMessage('set-overrides', (data) => {
        overridesRegistry.setOverrides(data.overrides);
      }),
      client.onMessage('get-response-body', async ({ requestId }) => {
        const request = networkRequestsRegistry.getEntry(requestId);

        if (!request) {
          return;
        }

        const body = await getResponseBody(request);

        client.send('response-body', {
          requestId,
          body,
        });
      }),
    ];

    // If recording was previously enabled, enable the inspector (hot reload)
    if (isRecordingEnabled) {
      httpInspector.enable();
    }

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      httpInspector.dispose();
    };
  }, [client, httpInspector, isEnabled, isRecordingEnabled]);
};
