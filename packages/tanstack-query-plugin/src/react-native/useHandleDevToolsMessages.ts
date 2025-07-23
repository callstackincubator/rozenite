import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TanStackQueryPluginClient } from '../shared/messaging';

export const useHandleDevToolsMessages = (
  client: TanStackQueryPluginClient | null
) => {
  const queryClient = useQueryClient();

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
