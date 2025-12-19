import { useEffect } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { TanStackQueryPluginClient } from '../shared/messaging';

export const useHandleDevToolsMessages = (
  queryClient: QueryClient,
  client: TanStackQueryPluginClient | null
) => {
  useEffect(() => {
    if (!client) {
      return;
    }

    const subscription = client.onMessage(
      'devtools-action',
      ({ type, queryHash }) => {
        const activeQuery = queryClient.getQueryCache().get(queryHash);

        if (!activeQuery) {
          console.warn(`No active query found for hash: ${queryHash}`);
          return;
        }

        switch (type) {
          case 'TRIGGER_ERROR': {
            // Code from React Query External Sync:
            // https://github.com/LovesWorking/react-query-external-sync/blob/main/src/react-query-external-sync/useSyncQueriesExternal.ts#L717

            const __previousQueryOptions = activeQuery.options;
            const error = new Error('Unknown error from devtools');

            activeQuery.setState({
              status: 'error',
              error,
              fetchMeta: {
                ...activeQuery.state.fetchMeta,
                // @ts-expect-error This does exist
                __previousQueryOptions,
              },
            });
            break;
          }
          case 'RESTORE_ERROR': {
            queryClient.resetQueries(activeQuery);
            break;
          }
          case 'TRIGGER_LOADING': {
            // Code from React Query External Sync:
            // https://github.com/LovesWorking/react-query-external-sync/blob/main/src/react-query-external-sync/useSyncQueriesExternal.ts#L742

            if (!activeQuery) return;
            const __previousQueryOptions = activeQuery.options;
            // Trigger a fetch in order to trigger suspense as well.
            activeQuery.fetch({
              ...__previousQueryOptions,
              queryFn: () => {
                return new Promise(() => {
                  // Never resolve - simulates perpetual loading
                });
              },
              gcTime: -1,
            });
            activeQuery.setState({
              data: undefined,
              status: 'pending',
              fetchMeta: {
                ...activeQuery.state.fetchMeta,
                // @ts-expect-error This does exist
                __previousQueryOptions,
              },
            });
            break;
          }
          case 'RESTORE_LOADING': {
            // Code from React Query External Sync:
            // https://github.com/LovesWorking/tanstack-query-dev-tools-expo-plugin/blob/main/src/useSyncQueries.ts#L176

            const previousState = activeQuery.state;
            const previousOptions = activeQuery.state.fetchMeta
              ? (
                  activeQuery.state.fetchMeta as unknown as {
                    __previousQueryOptions: unknown;
                  }
                ).__previousQueryOptions
              : null;

            activeQuery.cancel({ silent: true });
            activeQuery.setState({
              ...previousState,
              fetchStatus: 'idle',
              fetchMeta: null,
            });

            if (previousOptions) {
              activeQuery.fetch(previousOptions);
            }
            break;
          }
          case 'RESET': {
            queryClient.resetQueries(activeQuery);
            break;
          }
          case 'REMOVE': {
            queryClient.removeQueries(activeQuery);
            break;
          }
          case 'REFETCH': {
            activeQuery.fetch().catch(() => {
              // Ignore errors
            });
            break;
          }
          case 'INVALIDATE': {
            queryClient.invalidateQueries(activeQuery);
            break;
          }
          default: {
            console.warn(`Unknown devtools action: ${type}`);
          }
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [client]);
};
