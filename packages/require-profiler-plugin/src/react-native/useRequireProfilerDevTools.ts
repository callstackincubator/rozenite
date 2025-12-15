import { useEffect } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { RequireProfilerEventMap } from '../shared/messaging';

export const useRequireProfilerDevTools = () => {
  const client = useRozeniteDevToolsClient<RequireProfilerEventMap>({
    pluginId: '@rozenite/require-profiler-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    // Listen for data requests
    const subscription = client.onMessage('request-data', () => {
      // Check if the global function is available
      if (
        typeof global !== 'undefined' &&
        typeof (global as any).getRequireTimings === 'function'
      ) {
        try {
          // Call the function stored in global context
          const data = (global as any).getRequireTimings();

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
      } else {
        // Function not available, send null
        client.send('data-response', {
          type: 'data-response',
          data: null,
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [client]);

  return client;
};
