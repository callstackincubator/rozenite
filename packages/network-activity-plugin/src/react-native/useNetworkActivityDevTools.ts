import { useEffect, useRef } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { getOverridesRegistry } from './http/overrides-registry';
import { NetworkActivityEventMap } from '../shared/client';
import {
  DEFAULT_CONFIG,
  NetworkActivityDevToolsConfig,
  validateConfig,
} from './config';
import { getHTTPInspectorInstance } from './http/http-setup';
import { getWebSocketInspectorInstance } from './websocket/websocket-setup';
import { getSSEInspectorInstance } from './sse/sse-setup';
import { withOnBootNetworkActivityRecording } from './withOnBootNetworkActivityRecording';
import { getResponseBody } from './http/http-utils';

// Enable boot recording by default when this module is imported and get the events listener
const eventsListener = withOnBootNetworkActivityRecording();

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
          showUrlAsName: showUrlAsName ?? DEFAULT_CONFIG.clientUISettings?.showUrlAsName,
        },
      });
    }

    const subscriptions = [
      client.onMessage('network-enable', () => {
        isRecordingEnabledRef.current = true;
        // Connect the events listener to send events through the DevTools client
        // This also automatically flushes any queued messages
        eventsListener.connect((type, data) => client.send(type, data));
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

    const httpInspector = getHTTPInspectorInstance(eventsListener);
    const networkRequestsRegistry = httpInspector.getNetworkRequestsRegistry();

    const subscriptions = [
      client.onMessage('network-enable', () => {
        httpInspector.enable();
      }),
      client.onMessage('network-disable', () => {
        httpInspector.disable();
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
      httpInspector.enable();
    }

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      httpInspector.dispose();
    };
  }, [client, isHttpInspectorEnabled]);

  useEffect(() => {
    if (!client || !isWebSocketInspectorEnabled) {
      return;
    }

    const websocketInspector = getWebSocketInspectorInstance(eventsListener);

    const subscriptions = [
      client.onMessage('network-enable', () => {
        websocketInspector.enable();
      }),
      client.onMessage('network-disable', () => {
        websocketInspector.disable();
      }),
    ];

    // If recording was previously enabled, enable the inspector (hot reload)
    if (isRecordingEnabledRef.current) {
      websocketInspector.enable();
    }

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      websocketInspector.dispose();
    };
  }, [client, isWebSocketInspectorEnabled]);

  useEffect(() => {
    if (!client || !isSSEInspectorEnabled) {
      return;
    }

    const sseInspector = getSSEInspectorInstance(eventsListener);

    const subscriptions = [
      client.onMessage('network-enable', () => {
        sseInspector.enable();
      }),
      client.onMessage('network-disable', () => {
        sseInspector.disable();
      }),
    ];

    // If recording was previously enabled, enable the inspector (hot reload)
    if (isRecordingEnabledRef.current) {
      sseInspector.enable();
    }

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      sseInspector.dispose();
    };
  }, [client, isSSEInspectorEnabled]);

  return client;
};
