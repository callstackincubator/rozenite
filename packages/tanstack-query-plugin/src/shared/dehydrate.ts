import type { Query, Mutation, QueryClient } from '@tanstack/react-query';
import type {
  SerializableQuery,
  SerializableMutation,
  SerializableObserver,
  SerializableQueryClient,
} from './types';

export const dehydrateObservers = (query: Query): SerializableObserver[] => {
  return query.observers.map((observer) => ({
    queryHash: query.queryHash,
    options: observer.options,
  }));
};

export const dehydrateQuery = (query: Query): SerializableQuery => {
  const dehydratedObservers: SerializableObserver[] = dehydrateObservers(query);

  return {
    state: query.state,
    queryKey: query.queryKey,
    queryHash: query.queryHash,
    observers: dehydratedObservers,
  };
};

export const dehydrateMutation = (mutation: Mutation): SerializableMutation => {
  return {
    mutationId: mutation.mutationId,
    state: mutation.state,
    options: mutation.options,
  };
};

export const dehydrateQueryClient = (
  queryClient: QueryClient
): SerializableQueryClient => {
  return {
    queries: queryClient.getQueryCache().getAll().map(dehydrateQuery),
    mutations: queryClient.getMutationCache().getAll().map(dehydrateMutation),
  };
};
