import { useEffect } from 'react';
import type { SSEInspector } from './sse/sse-inspector';
import type { NetworkActivityDevToolsClient } from '../shared/client';

export const useSSEInspector = (
  client: NetworkActivityDevToolsClient | null,
  sseInspector: SSEInspector,
  isEnabled: boolean,
  isRecordingEnabled: boolean
) => {
  useEffect(() => {
    if (!client || !isEnabled) {
      return;
    }

    const subscriptions = [
      client.onMessage('network-enable', () => {
        sseInspector.enable();
      }),
      client.onMessage('network-disable', () => {
        sseInspector.disable();
      }),
    ];

    // If recording was previously enabled, enable the inspector (hot reload)
    if (isRecordingEnabled) {
      sseInspector.enable();
    }

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      sseInspector.dispose();
    };
  }, [client, sseInspector, isEnabled, isRecordingEnabled]);
};
