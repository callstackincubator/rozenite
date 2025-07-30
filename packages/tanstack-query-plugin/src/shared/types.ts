import type {
  QueryKey,
  MutationState,
  QueryState,
  QueryObserverOptions,
  InfiniteQueryObserverOptions,
  MutationOptions,
} from '@tanstack/react-query';

export type SerializableQuery = {
  queryHash: string;
  state: QueryState;
  queryKey: QueryKey;
  observers: SerializableObserver[];
};

export type PartialQueryState = {
  queryHash: string;
  state: Partial<QueryState>;
};

export type SerializableMutation = {
  mutationId: number;
  options: MutationOptions;
  state: MutationState;
};

export type SerializableObserver = {
  queryHash: string;
  options: QueryObserverOptions | InfiniteQueryObserverOptions;
};

export type SerializableQueryClient = {
  queries: SerializableQuery[];
  mutations: SerializableMutation[];
};

export type DevToolsActionType =
  | 'REFETCH'
  | 'INVALIDATE'
  | 'RESET'
  | 'REMOVE'
  | 'TRIGGER_ERROR'
  | 'RESTORE_ERROR'
  | 'TRIGGER_LOADING'
  | 'RESTORE_LOADING'
  | 'CLEAR_MUTATION_CACHE'
  | 'CLEAR_QUERY_CACHE';
