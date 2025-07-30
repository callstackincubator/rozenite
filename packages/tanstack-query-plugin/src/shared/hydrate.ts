import {
  InfiniteQueryObserverOptions,
  MutationOptions,
  MutationState,
  QueryClient,
  QueryObserver,
  QueryObserverOptions,
  QueryState,
} from '@tanstack/react-query';
import type {
  SerializableQuery,
  SerializableMutation,
  SerializableQueryClient,
  SerializableObserver,
  PartialQueryState,
} from './types';

const mockQueryFn = () => {
  return Promise.resolve(null);
};

const hydrateObservers = (
  client: QueryClient,
  queryHash: string,
  dehydratedObservers: SerializableObserver[]
) => {
  const query = client.getQueryCache().get(queryHash);

  if (!query) {
    return;
  }

  query.observers.forEach((observer) => {
    query.removeObserver(observer);
  });

  dehydratedObservers.forEach((observerState) => {
    const hydratedOptions: InfiniteQueryObserverOptions | QueryObserverOptions =
      observerState.options;

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
};

const hydrateMutation = (
  client: QueryClient,
  dehydratedMutation: SerializableMutation
) => {
  const mutationCache = client.getMutationCache();
  const { options, state } = dehydratedMutation;

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
};

const hydrateQuery = (
  client: QueryClient,
  dehydratedQuery: SerializableQuery
) => {
  const queryCache = client.getQueryCache();
  const { queryKey, state, queryHash, observers } = dehydratedQuery;

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

  hydrateObservers(client, queryHash, observers);
};

export const hydrateQueryClient = (
  client: QueryClient,
  dehydratedState: SerializableQueryClient
): void => {
  // Hydrate mutations
  dehydratedState.mutations.forEach((mutation) =>
    hydrateMutation(client, mutation)
  );

  // Hydrate queries
  dehydratedState.queries.forEach((query) => hydrateQuery(client, query));
};

export const applyQueryEvent = (
  queryClient: QueryClient,
  type:
    | 'added'
    | 'updated'
    | 'removed'
    | 'observerAdded'
    | 'observerRemoved'
    | 'observerResultsUpdated'
    | 'observerOptionsUpdated',
  data: SerializableQuery | PartialQueryState,
  action?: string
): void => {
  const queryCache = queryClient.getQueryCache();

  switch (type) {
    case 'added': {
      hydrateQuery(queryClient, data as SerializableQuery);
      break;
    }
    case 'updated': {
      if (action && 'state' in data && !('queryKey' in data)) {
        // Handle action-based partial state update
        applyPartialQueryState(queryClient, data as PartialQueryState);
      } else {
        // Handle full query update (backward compatibility)
        hydrateQuery(queryClient, data as SerializableQuery);
      }
      break;
    }
    case 'observerAdded':
    case 'observerRemoved':
    case 'observerOptionsUpdated': {
      hydrateObservers(queryClient, data.queryHash, (data as any).observers);
      break;
    }
    case 'removed': {
      const query = queryCache.get(data.queryHash);
      if (query) {
        queryCache.remove(query);
      }
      break;
    }
  }
};

// New function to handle action-based partial state updates
export const applyPartialQueryState = (
  queryClient: QueryClient,
  data: PartialQueryState
): void => {
  const queryCache = queryClient.getQueryCache();
  const query = queryCache.get(data.queryHash);

  if (!query) {
    // Query doesn't exist, we need to create it with minimal data
    // This is a fallback for when we receive a partial update for a non-existent query
    return;
  }

  // Apply the partial state changes
  if (data.state) {
    query.setState(data.state);
  }
};

export const applyMutationEvent = (
  queryClient: QueryClient,
  type:
    | 'added'
    | 'updated'
    | 'removed'
    | 'observerAdded'
    | 'observerRemoved'
    | 'observerResultsUpdated'
    | 'observerOptionsUpdated',
  data: SerializableMutation
): void => {
  const mutationCache = queryClient.getMutationCache();

  switch (type) {
    case 'added':
    case 'updated':
    case 'observerAdded':
    case 'observerRemoved':
    case 'observerResultsUpdated':
    case 'observerOptionsUpdated': {
      hydrateMutation(queryClient, data);
      break;
    }
    case 'removed': {
      const mutation = mutationCache.find({
        mutationKey: data.options.mutationKey,
      });
      if (mutation) {
        mutationCache.remove(mutation);
      }
      break;
    }
  }
};

export const applyQueryObserverEvent = (
  queryClient: QueryClient,
  data: {
    queryHash: string;
    observers: SerializableObserver[];
  }
): void => {
  hydrateObservers(queryClient, data.queryHash, data.observers);
};
