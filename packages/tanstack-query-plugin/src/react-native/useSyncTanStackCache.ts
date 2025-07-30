import {
  QueryClient,
  QueryCacheNotifyEvent,
  MutationCacheNotifyEvent,
} from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import equal from 'fast-deep-equal';
import { TanStackQueryPluginClient } from '../shared/messaging';
import {
  dehydrateQuery,
  dehydrateMutation,
  dehydrateObservers,
} from '../shared/dehydrate';
import { SerializableObserver, PartialQueryState } from '../shared/types';

export const useSyncTanStackCache = (
  queryClient: QueryClient,
  client: TanStackQueryPluginClient | null
) => {
  const previousObserversRef = useRef<Map<string, SerializableObserver[]>>(
    new Map()
  );

  const handler = useMemo(() => {
    return (event: QueryCacheNotifyEvent | MutationCacheNotifyEvent): void => {
      if (!client) {
        return;
      }

      if (event.type === 'observerResultsUpdated') {
        // We don't need to sync this type of events.
        return;
      }

      if ('query' in event) {
        const { query, type } = event;

        if (type === 'added' || type === 'removed') {
          if (type === 'removed') {
            // We don't need to store observers for removed queries.
            previousObserversRef.current.delete(query.queryHash);
          }

          const dehydratedQuery = dehydrateQuery(query);
          client.send('sync-query-event', { type, data: dehydratedQuery });
          return;
        }

        if (type === 'updated' && 'action' in event) {
          const action = event.action;

          switch (action.type) {
            case 'fetch': {
              // Only need loading state and fetch metadata
              const fetchData: PartialQueryState = {
                queryHash: query.queryHash,
                state: {
                  status: query.state.status,
                  fetchStatus: query.state.fetchStatus,
                  fetchMeta: query.state.fetchMeta,
                  dataUpdatedAt: query.state.dataUpdatedAt,
                  errorUpdatedAt: query.state.errorUpdatedAt,
                },
              };
              client.send('sync-query-event', {
                type: 'updated',
                action: 'fetch',
                data: fetchData,
              });
              break;
            }

            case 'success': {
              // Only need new data and success state
              const successData: PartialQueryState = {
                queryHash: query.queryHash,
                state: {
                  status: query.state.status,
                  data: query.state.data,
                  dataUpdatedAt: query.state.dataUpdatedAt,
                  error: query.state.error,
                  errorUpdatedAt: query.state.errorUpdatedAt,
                  fetchStatus: query.state.fetchStatus,
                },
              };
              client.send('sync-query-event', {
                type: 'updated',
                action: 'success',
                data: successData,
              });
              break;
            }

            case 'error': {
              // Only need error information
              const errorData: PartialQueryState = {
                queryHash: query.queryHash,
                state: {
                  status: query.state.status,
                  error: query.state.error,
                  errorUpdatedAt: query.state.errorUpdatedAt,
                  fetchStatus: query.state.fetchStatus,
                },
              };
              client.send('sync-query-event', {
                type: 'updated',
                action: 'error',
                data: errorData,
              });
              break;
            }

            case 'setState': {
              // Only need the specific state changes
              const setStateData: PartialQueryState = {
                queryHash: query.queryHash,
                state: action.state, // Only the changed state parts
              };
              client.send('sync-query-event', {
                type: 'updated',
                action: 'setState',
                data: setStateData,
              });
              break;
            }

            case 'invalidate': {
              // Only need invalidation flag
              const invalidateData: PartialQueryState = {
                queryHash: query.queryHash,
                state: {
                  isInvalidated: query.state.isInvalidated,
                },
              };
              client.send('sync-query-event', {
                type: 'updated',
                action: 'invalidate',
                data: invalidateData,
              });
              break;
            }

            case 'pause': {
              // Need to sync the paused fetch status
              const pauseData: PartialQueryState = {
                queryHash: query.queryHash,
                state: {
                  fetchStatus: query.state.fetchStatus,
                },
              };
              client.send('sync-query-event', {
                type: 'updated',
                action: 'pause',
                data: pauseData,
              });
              break;
            }

            case 'continue': {
              // Need to sync the resumed fetch status
              const continueData: PartialQueryState = {
                queryHash: query.queryHash,
                state: {
                  fetchStatus: query.state.fetchStatus,
                },
              };
              client.send('sync-query-event', {
                type: 'updated',
                action: 'continue',
                data: continueData,
              });
              break;
            }

            default: {
              // Fallback to full data for unknown actions
              const dehydratedQuery = dehydrateQuery(query);
              client.send('sync-query-event', { type, data: dehydratedQuery });
            }
          }
          return;
        }

        if (
          type === 'observerAdded' ||
          type === 'observerRemoved' ||
          type === 'observerOptionsUpdated'
        ) {
          const dehydratedObservers = dehydrateObservers(query);
          const previousObservers = previousObserversRef.current.get(
            query.queryHash
          );

          // For observerOptionsUpdated, only send if the observers actually changed
          if (type === 'observerOptionsUpdated' && previousObservers) {
            if (equal(previousObservers, dehydratedObservers)) {
              // No meaningful change, skip sending
              return;
            }
          }

          previousObserversRef.current.set(
            query.queryHash,
            dehydratedObservers
          );

          client.send('sync-query-event', {
            type,
            data: {
              queryHash: query.queryHash,
              observers: dehydratedObservers,
            },
          });
          return;
        }
      }

      const { mutation, type } = event;
      if (mutation) {
        const dehydratedMutation = dehydrateMutation(mutation);
        client.send('sync-mutation-event', {
          type,
          data: dehydratedMutation,
        });
      }
    };
  }, [client]);

  useEffect(() => {
    if (!client) {
      return;
    }

    const mutationCacheSubscription = queryClient
      .getMutationCache()
      .subscribe(handler);
    const queryCacheSubscription = queryClient
      .getQueryCache()
      .subscribe(handler);

    return () => {
      mutationCacheSubscription();
      queryCacheSubscription();
    };
  }, [client, queryClient, handler]);
};
