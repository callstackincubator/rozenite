import { useEffect, useRef } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { NetworkActivityEventMap } from '../shared/client';
import { isHttpEvent } from './http/http-inspector';
import { isWebSocketEvent } from './websocket/websocket-inspector';
import { isSSEEvent } from './sse/sse-inspector';
import {
  DEFAULT_CONFIG,
  NetworkActivityDevToolsConfig,
  validateConfig,
} from './config';
import { createNetworkInspectorsConfiguration } from './withOnBootNetworkActivityRecording';
import { useHttpInspector } from './useHttpInspector';
import { useWebSocketInspector } from './useWebSocketInspector';
import { useSSEInspector } from './useSSEInspector';

const inspectorsConfig = createNetworkInspectorsConfiguration();

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
        eventsListener.connect(client.send, (message) => {

          // The below allow filtering out events based on the configuration passed to the hook
          const type = message.type;
          if (isHttpEvent(type)) {
            return isHttpInspectorEnabled;
          }
          if (isWebSocketEvent(type)) {
            return isWebSocketInspectorEnabled;
          }
          if (isSSEEvent(type)) {
            return isSSEInspectorEnabled;
          }
          return true;
        });
      }),
      client.onMessage('network-disable', () => {
        isRecordingEnabledRef.current = false;
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
  }, [
    client,
    showUrlAsName,
    isHttpInspectorEnabled,
    isWebSocketInspectorEnabled,
    isSSEInspectorEnabled,
  ]);

  useHttpInspector(
    client,
    networkInspector.http,
    isHttpInspectorEnabled,
    isRecordingEnabledRef.current
  );

  useWebSocketInspector(
    client,
    networkInspector.websocket,
    isWebSocketInspectorEnabled,
    isRecordingEnabledRef.current
  );

  useSSEInspector(
    client,
    networkInspector.sse,
    isSSEInspectorEnabled,
    isRecordingEnabledRef.current
  );

  return client;
};
