import { useEffect } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { RequireProfilerEventMap } from '../shared';
import { getRequireTimings } from './timings';
import { DevSettings } from 'react-native';

export const useRequireProfilerDevTools = () => {
  const client = useRozeniteDevToolsClient<RequireProfilerEventMap>({
    pluginId: '@rozenite/require-profiler-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    // Listen for reload and profile requests
    const reloadSubscription = client.onMessage('reload-and-profile', () => {
      // Reload the React Native app to start fresh profiling
      DevSettings.reload();
    });

    // Listen for data requests
    const dataSubscription = client.onMessage('request-data', () => {
      try {
        // Call the function stored in global context
        const data = getRequireTimings();

        // Send the data back to the UI
        client.send('data-response', {
          type: 'data-response',
          data,
        });
      } catch (error) {
        console.error(
          '[Rozenite] Require Profiler: Error getting require timings',
          error,
        );

        // Send null on error
        client.send('data-response', {
          type: 'data-response',
          data: null,
        });
      }
    });

    return () => {
      reloadSubscription.remove();
      dataSubscription.remove();
    };
  }, [client]);

  return client;
};
