import { QueryCacheNotifyEvent, MutationCacheNotifyEvent, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useRef } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async () => {
        // Prevent refetch from throwing an error
        return Promise.resolve(null);
      },
    },
  },
});

type DevToolsEventMap = {
  "DEVTOOLS_TO_DEVICE": unknown;
  "DEVICE_TO_DEVTOOLS": QueryCacheNotifyEvent | MutationCacheNotifyEvent;
  "DEVICE_TO_DEVTOOLS_ACK": { requestId: string; success: boolean };
}

const Wrapped = () => {
  const client = useRozeniteDevToolsClient<DevToolsEventMap>({
    pluginId: '@rozenite/tanstack-query-plugin',
  })

  // Track pending acknowledgments to prevent feedback loops
  const pendingAcknowledgment = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!client) return;

    const handleEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      
      // Generate a unique request ID for this DevTools action
      const requestId = `devtools-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Mark that we're waiting for acknowledgment
      pendingAcknowledgment.current.add(requestId);
      
      // Add the request ID to the event detail
      const eventWithRequestId = {
        ...detail,
        requestId,
      };
      
      client.send("DEVTOOLS_TO_DEVICE", eventWithRequestId);
    };

    window.addEventListener('@tanstack/query-devtools-event', handleEvent);
    return () => window.removeEventListener('@tanstack/query-devtools-event', handleEvent);
  }, [client])

  useEffect(() => {
    if (!client) return;

    const ackSubscription = client.onMessage("DEVICE_TO_DEVTOOLS_ACK", (ack) => {
      // Remove the request from pending acknowledgments
      pendingAcknowledgment.current.delete(ack.requestId);
    });

    const subscription = client.onMessage("DEVICE_TO_DEVTOOLS", (event) => {
      // Don't reflect events if we're waiting for acknowledgments
      if (pendingAcknowledgment.current.size > 0) {
        return;
      }
      
      if ('query' in event) {
        const { query, type } = event as QueryCacheNotifyEvent;
        const queryCache = queryClient.getQueryCache();
        
        if (type === 'updated') {
          const existingQuery = queryCache.get(query.queryHash);
          if (existingQuery) {
            existingQuery.setState(query.state);
          } else {
            queryCache.build(
              queryClient,
              {
                queryKey: query.queryKey,
                queryHash: query.queryHash,
              },
              query.state
            );
          }
        } else if (type === 'added') {
          const existingQuery = queryCache.get(query.queryHash);
          if (!existingQuery) {
            // Only add if it doesn't already exist
            queryCache.build(
              queryClient,
              {
                queryKey: query.queryKey,
                queryHash: query.queryHash,
              },
              query.state
            );
          }
        } else if (type === 'removed') {
          const existingQuery = queryCache.get(query.queryHash);
          if (existingQuery) {
            queryCache.remove(existingQuery);
          }
        }
      } else if ('mutation' in event) {
        const { mutation, type } = event as MutationCacheNotifyEvent;
        const mutationCache = queryClient.getMutationCache();
        
        if (type === 'added') {
          const existingMutation = mutationCache.find({ mutationKey: mutation.options.mutationKey });
          if (existingMutation) {
            mutationCache.remove(existingMutation);
          }

          mutationCache.build(
            queryClient,
            mutation.options,
            mutation.state
          );
        } else if (type === 'removed') {
          const existingMutation = mutationCache.find({ mutationKey: mutation.options.mutationKey });
          if (existingMutation) {
            mutationCache.remove(existingMutation);
          }
        } else if (type === 'updated') {
          const existingMutation = mutationCache.find({ mutationKey: mutation.options.mutationKey });
          
          if (existingMutation) {
            mutationCache.remove(existingMutation);
            mutationCache.build(
              queryClient,
              mutation.options,
              mutation.state
            );
          }
        }
      }
    })

    return () => {
      subscription.remove();
      ackSubscription.remove();
    };
  }, [client, queryClient])


  return (
    <ReactQueryDevtoolsPanel />
  )
}

export default function TanstackQueryPanel() {
  return (
    <QueryClientProvider client={queryClient}>
      <Wrapped />
    </QueryClientProvider>
  )
}