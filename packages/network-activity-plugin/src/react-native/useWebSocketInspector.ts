import { useEffect } from 'react';
import type { WebSocketInspector } from './websocket/websocket-inspector';
import type { NetworkActivityDevToolsClient } from '../shared/client';

export const useWebSocketInspector = (
  client: NetworkActivityDevToolsClient | null,
  websocketInspector: WebSocketInspector,
  isEnabled: boolean,
  isRecordingEnabled: boolean
) => {
  useEffect(() => {
    if (!client || !isEnabled) {
      return;
    }

    const subscriptions = [
      client.onMessage('network-enable', () => {
        websocketInspector.enable();
      }),
      client.onMessage('network-disable', () => {
        websocketInspector.disable();
      }),
    ];

    // If recording was previously enabled, enable the inspector (hot reload)
    if (isRecordingEnabled) {
      websocketInspector.enable();
    }

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      websocketInspector.dispose();
    };
  }, [client, websocketInspector, isEnabled, isRecordingEnabled]);
};
