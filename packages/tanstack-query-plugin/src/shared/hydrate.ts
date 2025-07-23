import {
  InfiniteQueryObserverOptions,
  MutationOptions,
  MutationState,
  QueryClient,
  QueryObserver,
  QueryObserverOptions,
  QueryState,
} from '@tanstack/react-query';
import { SerializableQueryClient } from './types';

const mockQueryFn = () => {
  return Promise.resolve(null);
};

export const hydrateQueryClient = (
  client: QueryClient,
  dehydratedState: SerializableQueryClient
): void => {
  const queryCache = client.getQueryCache();
  const mutationCache = client.getMutationCache();

  // Sync mutations
  dehydratedState.mutations.forEach(({ options, state }) => {
    const existingMutation = mutationCache.find({
      mutationKey: options.mutationKey,
    });
    const hydratedState: MutationState<unknown, Error, void, unknown> =
      state as MutationState<unknown, Error, void, unknown>;
    const hydratedOptions: MutationOptions = options;

    if (existingMutation) {
      mutationCache.remove(existingMutation);
    }

    mutationCache.build(client, hydratedOptions, hydratedState);
  });

  // Hydrate queries
  dehydratedState.queries.forEach(
    ({ queryKey, state, queryHash, observers }) => {
      let query = queryCache.get(queryHash);
      const data = state.data;
      const hydratedState: QueryState = state;

      // Do not hydrate if an existing query exists with newer data
      if (query) {
        if (
          query.state.dataUpdatedAt < state.dataUpdatedAt ||
          query.state.fetchStatus !== state.fetchStatus
        ) {
          query.setState({
            ...hydratedState,
            data,
          });
          query.setOptions({
            ...query.options,
            queryFn: mockQueryFn,
            retry: 0,
          });
        }
      } else {
        // Restore query
        query = queryCache.build(
          client,
          {
            ...client.getDefaultOptions().hydrate?.queries,
            queryKey,
            queryHash,
            queryFn: mockQueryFn,
          },
          {
            ...hydratedState,
            data,
          }
        );
      }

      query.observers.forEach((observer) => {
        query.removeObserver(observer);
      });

      observers.forEach((observerState) => {
        const hydratedOptions:
          | InfiniteQueryObserverOptions
          | QueryObserverOptions = observerState.options;

        if ('initialPageParam' in hydratedOptions) {
          delete hydratedOptions.initialPageParam;
        }

        if ('behavior' in hydratedOptions) {
          delete hydratedOptions.behavior;
        }

        hydratedOptions.queryFn = mockQueryFn;

        const observer = new QueryObserver(
          client,
          hydratedOptions as QueryObserverOptions
        );
        query.addObserver(observer);
      });
    }
  );
};
