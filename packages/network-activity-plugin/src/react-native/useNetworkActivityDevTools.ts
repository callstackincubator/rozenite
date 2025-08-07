import { useEffect } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { getNetworkInspector } from './http/network-inspector';
import { NetworkActivityEventMap } from '../shared/client';
import { getWebSocketInspector } from './websocket/websocket-inspector';
import { WebSocketEventMap } from '../shared/websocket-events';
import { UnionToTuple } from './utils';
import { getSSEInspector } from './sse/sse-inspector';
import { SSEEventMap } from '../shared/sse-events';

export const useNetworkActivityDevTools = () => {
  const client = useRozeniteDevToolsClient<NetworkActivityEventMap>({
    pluginId: '@rozenite/network-activity-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const networkInspector = getNetworkInspector(client);

    return () => {
      networkInspector.dispose();
    };
  }, [client]);

  useEffect(() => {
    if (!client) {
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

    return () => {
      // Subscriptions will be disposed by the inspector
      websocketInspector.dispose();
    };
  }, [client]);

  useEffect(() => {
    if (!client) {
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

    return () => {
      // Subscriptions will be disposed by the inspector
      sseInspector.dispose();
    };
  }, [client]);

  return client;
};
