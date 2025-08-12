import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect } from 'react';
import { getPerformanceMonitor } from './performance-monitor';
import { PerformanceMonitorEventMap } from '../shared/types';

export const usePerformanceMonitorDevTools = () => {
  const client = useRozeniteDevToolsClient<PerformanceMonitorEventMap>({
    pluginId: '@rozenite/performance-monitor-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const performanceMonitor = getPerformanceMonitor(client);

    const subscription = client.onMessage('setEnabled', ({ enabled }) => {
      if (enabled) {
        performanceMonitor.enable();
      } else {
        performanceMonitor.disable();
      }
    });

    return () => {
      subscription.remove();
      performanceMonitor.dispose();
    };
  }, [client]);
};
