import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { TanStackQueryPluginClient } from '../shared/messaging';

export const useSyncDevToolsEvents = (
  client: TanStackQueryPluginClient | null
) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!client) {
      return;
    }

    const handleEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const { type, queryHash } = detail;

      // Get the query from cache if we have a hash
      const query = queryHash
        ? queryClient.getQueryCache().get(queryHash)
        : undefined;
      if (
        !query &&
        type !== 'CLEAR_QUERY_CACHE' &&
        type !== 'CLEAR_MUTATION_CACHE'
      ) {
        return;
      }

      // Special handling for cache clear actions which don't require a query
      if (type === 'CLEAR_QUERY_CACHE' || type === 'CLEAR_MUTATION_CACHE') {
        client.send('devtools-action', {
          type,
          queryHash: '',
        });
        return;
      }

      // For all other actions, ensure we have a valid query
      if (!query || !queryHash) {
        return;
      }

      client.send('devtools-action', {
        type,
        queryHash: query.queryHash,
      });
    };

    window.addEventListener('@tanstack/query-devtools-event', handleEvent);
    return () =>
      window.removeEventListener('@tanstack/query-devtools-event', handleEvent);
  }, [client]);
};
