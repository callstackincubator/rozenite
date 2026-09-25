import { useEffect, useRef } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { NetworkActivityEventMap } from '../shared/client';
import { isHttpEvent } from './network-inspector';
import { isWebSocketEvent } from './websocket/websocket-inspector';
import { isSSEEvent } from './sse/sse-inspector';
import { overridesRegistry } from './http/overrides-registry';
import { recorder } from './http/recorder';
import { disableXhrHook } from './http/xhr-hook';
import { disableFetchHook } from './http/fetch-hook';
import { DEFAULT_CONFIG, NetworkActivityDevToolsConfig, validateConfig } from './config';
import { createNetworkInspectorsConfiguration } from './boot-recording';
import { useNetworkActivityAgentTools } from './agent/use-network-activity-agent-tools';

const inspectorsConfig = createNetworkInspectorsConfiguration();

export const useNetworkActivityDevTools = (
  config: NetworkActivityDevToolsConfig = DEFAULT_CONFIG,
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

  useNetworkActivityAgentTools({
    client,
    networkInspector,
    enabledInspectors: {
      http: isHttpInspectorEnabled,
      websocket: isWebSocketInspectorEnabled,
      sse: isSSEInspectorEnabled,
    },
  });

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

    const enableInspectors = () => {
      networkInspector.enable({
        http: isHttpInspectorEnabled,
        websocket: isWebSocketInspectorEnabled,
        sse: isSSEInspectorEnabled,
      });
    };

    const sendClientUISettings = () => {
      client.send('client-ui-settings', {
        settings: {
          showUrlAsName: showUrlAsName ?? DEFAULT_CONFIG.clientUISettings?.showUrlAsName,
        },
      });
    };

    const subscriptions = [
      client.onMessage('network-enable', () => {
        isRecordingEnabledRef.current = true;
        enableInspectors();

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
        networkInspector.disable();
      }),
      client.onMessage('get-client-ui-settings', () => {
        sendClientUISettings();
      }),
      ...(isHttpInspectorEnabled
        ? [
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
          ]
        : []),
    ];

    // If recording was previously enabled, enable the inspectors (hot reload)
    if (isRecordingEnabledRef.current) {
      enableInspectors();
    }

    // Inform the DevTools UI of the current recording state so it can detect
    // and resolve desynchronization (e.g. after an app reload)
    client.send('recording-state', {
      isRecording: isRecordingEnabledRef.current,
    });

    // Send initial or changed values live
    sendClientUISettings();

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [
    client,
    networkInspector,
    eventsListener,
    showUrlAsName,
    isHttpInspectorEnabled,
    isWebSocketInspectorEnabled,
    isSSEInspectorEnabled,
  ]);

  // Kept separate from the effect above: disposing (which clears captured
  // bodies and re-enables capture on hot reload) must not run every time
  // `showUrlAsName` or another client-UI setting changes.
  useEffect(() => {
    if (!client) {
      return;
    }

    return () => {
      if (isHttpInspectorEnabled) {
        disableXhrHook();
        disableFetchHook();
        recorder.clear();
      }
      if (isWebSocketInspectorEnabled) networkInspector.websocket.dispose();
      if (isSSEInspectorEnabled) networkInspector.sse.dispose();
    };
  }, [
    client,
    networkInspector,
    isHttpInspectorEnabled,
    isWebSocketInspectorEnabled,
    isSSEInspectorEnabled,
  ]);

  return client;
};
