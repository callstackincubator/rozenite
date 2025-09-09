import { useEffect, useRef } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { getNetworkInspector } from './http/network-inspector';
import { NetworkActivityEventMap } from '../shared/client';
import { getWebSocketInspector } from './websocket/websocket-inspector';
import { WebSocketEventMap } from '../shared/websocket-events';
import { UnionToTuple } from './utils';
import { getSSEInspector } from './sse/sse-inspector';
import { SSEEventMap } from '../shared/sse-events';
import {
  DEFAULT_CONFIG,
  NetworkActivityDevToolsConfig,
  validateConfig,
} from './config';

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

    const subscriptions = [
      client.onMessage('network-enable', () => {
        isRecordingEnabledRef.current = true;
      }),
      client.onMessage('network-disable', () => {
        isRecordingEnabledRef.current = false;
      }),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [client]);

  useEffect(() => {
    if (!client || !isHttpInspectorEnabled) {
      return;
    }

    const networkInspector = getNetworkInspector(client);

    // If recording was previously enabled, enable the inspector (hot reload)
    if (isRecordingEnabledRef.current) {
      networkInspector.enable();
    }

    return () => {
      networkInspector.dispose();
    };
  }, [client, isHttpInspectorEnabled]);

  useEffect(() => {
    if (!client || !isWebSocketInspectorEnabled) {
      return;
    }

    const eventsToForward: UnionToTuple<keyof WebSocketEventMap> = [
      'websocket-connect',
      'websocket-open',
      'websocket-close',
      'websocket-message-sent',
      'websocket-message-received',
      'websocket-error',
      'websocket-connection-status-changed',
    ];
    const websocketInspector = getWebSocketInspector();

    eventsToForward.forEach((event) => {
      websocketInspector.on(event, (event) => {
        client.send(event.type, event);
      });
    });

    client.onMessage('network-enable', () => {
      websocketInspector.enable();
    });

    client.onMessage('network-disable', () => {
      websocketInspector.disable();
    });

    // If recording was previously enabled, enable the inspector (hot reload)
    if (isRecordingEnabledRef.current) {
      websocketInspector.enable();
    }

    return () => {
      // Subscriptions will be disposed by the inspector
      websocketInspector.dispose();
    };
  }, [client, isWebSocketInspectorEnabled]);

  useEffect(() => {
    if (!client || !isSSEInspectorEnabled) {
      return;
    }

    const eventsToForward: UnionToTuple<keyof SSEEventMap> = [
      'sse-open',
      'sse-message',
      'sse-error',
      'sse-close',
    ];
    const sseInspector = getSSEInspector();

    eventsToForward.forEach((event) => {
      sseInspector.on(event, (event) => {
        client.send(event.type, event);
      });
    });

    client.onMessage('network-enable', () => {
      sseInspector.enable();
    });

    client.onMessage('network-disable', () => {
      sseInspector.disable();
    });

    // If recording was previously enabled, enable the inspector (hot reload)
    if (isRecordingEnabledRef.current) {
      sseInspector.enable();
    }

    return () => {
      // Subscriptions will be disposed by the inspector
      sseInspector.dispose();
    };
  }, [client, isSSEInspectorEnabled]);

  return client;
};
