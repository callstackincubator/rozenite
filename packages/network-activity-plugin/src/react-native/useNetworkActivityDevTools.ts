import { useEffect, useRef } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { getOverridesRegistry } from './http/overrides-registry';
import { NetworkActivityEventMap } from '../shared/client';
import {
  DEFAULT_CONFIG,
  NetworkActivityDevToolsConfig,
  validateConfig,
} from './config';
import { createNetworkInspectorsConfiguration } from './withOnBootNetworkActivityRecording';
import { getResponseBody } from './http/http-utils';

const inspectorsConfig = createNetworkInspectorsConfiguration();
const overridesRegistry = getOverridesRegistry();

export const useNetworkActivityDevTools = (
  config: NetworkActivityDevToolsConfig = DEFAULT_CONFIG
) => {
  const isRecordingEnabledRef = useRef(false);
  const client = useRozeniteDevToolsClient<NetworkActivityEventMap>({
    pluginId: '@rozenite/network-activity-plugin',
  });

  const isHttpInspectorEnabled = config.inspectors?.http ?? true;
  const isWebSocketInspectorEnabled = config.inspectors?.websocket ?? true;
  const isSSEInspectorEnabled = config.inspectors?.sse ?? true;
  const showUrlAsName = config.clientUISettings?.showUrlAsName;

  const { eventsListener, networkInspector } = inspectorsConfig;

  useEffect(() => {
    if (!client) {
      return;
    }

    validateConfig(config);
  }, [config]);

  /** Persist the recording state across hot reloads */
  useEffect(() => {
    if (!client) {
      return;
    }

    const sendClientUISettings = () => {
      client.send('client-ui-settings', {
        settings: {
          showUrlAsName:
            showUrlAsName ?? DEFAULT_CONFIG.clientUISettings?.showUrlAsName,
        },
      });
    };

    const subscriptions = [
      client.onMessage('network-enable', () => {
        isRecordingEnabledRef.current = true;

        // Connect the events listener to send events through the DevTools client
        // This also automatically flushes any queued messages
        eventsListener.connect(client.send);
      }),
      client.onMessage('network-disable', () => {
        isRecordingEnabledRef.current = false;
      }),
      client.onMessage('set-overrides', (data) => {
        overridesRegistry.setOverrides(data.overrides);
      }),

      client.onMessage('get-client-ui-settings', () => {
        sendClientUISettings();
      }),
    ];

    // Send initial or changed values live
    sendClientUISettings();

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [client, showUrlAsName]);

  useEffect(() => {
    if (!client || !isHttpInspectorEnabled) {
      return;
    }

    const networkRequestsRegistry =
      networkInspector.http.getNetworkRequestsRegistry();

    const subscriptions = [
      client.onMessage('network-enable', () => {
        networkInspector.http.enable();
      }),
      client.onMessage('network-disable', () => {
        networkInspector.http.disable();
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
    if (isRecordingEnabledRef.current) {
      networkInspector.http.enable();
    }

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      networkInspector.http.dispose();
    };
  }, [client, isHttpInspectorEnabled]);

  useEffect(() => {
    if (!client || !isWebSocketInspectorEnabled) {
      return;
    }

    const subscriptions = [
      client.onMessage('network-enable', () => {
        networkInspector.websocket.enable();
      }),
      client.onMessage('network-disable', () => {
        networkInspector.websocket.disable();
      }),
    ];

    // If recording was previously enabled, enable the inspector (hot reload)
    if (isRecordingEnabledRef.current) {
      networkInspector.websocket.enable();
    }

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      networkInspector.websocket.dispose();
    };
  }, [client, isWebSocketInspectorEnabled]);

  useEffect(() => {
    if (!client || !isSSEInspectorEnabled) {
      return;
    }

    const subscriptions = [
      client.onMessage('network-enable', () => {
        networkInspector.sse.enable();
      }),
      client.onMessage('network-disable', () => {
        networkInspector.sse.disable();
      }),
    ];

    // If recording was previously enabled, enable the inspector (hot reload)
    if (isRecordingEnabledRef.current) {
      networkInspector.sse.enable();
    }

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      networkInspector.sse.dispose();
    };
  }, [client, isSSEInspectorEnabled]);

  return client;
};
