import { useEffect } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { getNetworkInspector } from './http/network-inspector';
import { NetworkActivityEventMap } from '../shared/client';
import { getWebSocketInspector } from './websocket/websocket-inspector';
import { WebSocketEventMap } from '../shared/websocket-events';
import { UnionToTuple } from './utils';

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

  return client;
};
