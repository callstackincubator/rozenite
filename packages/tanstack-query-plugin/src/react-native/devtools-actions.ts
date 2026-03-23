import { QueryClient } from '@tanstack/react-query';
import { DevToolsActionType } from '../shared/types';

type QueryScopedActionInput = {
  type: Exclude<
    DevToolsActionType,
    'CLEAR_MUTATION_CACHE' | 'CLEAR_QUERY_CACHE'
  >;
  queryHash: string;
};

type CacheScopedActionInput = {
  type: 'CLEAR_MUTATION_CACHE' | 'CLEAR_QUERY_CACHE';
  queryHash?: string;
};

export type TanStackQueryDevtoolsActionInput =
  | QueryScopedActionInput
  | CacheScopedActionInput;

const getActiveQuery = (queryClient: QueryClient, queryHash?: string) => {
  if (!queryHash) {
    throw new Error('queryHash is required for this TanStack Query action.');
  }

  const activeQuery = queryClient.getQueryCache().get(queryHash);
  if (!activeQuery) {
    throw new Error(`No active query found for hash: ${queryHash}`);
  }

  return activeQuery;
};

export const applyTanStackQueryDevtoolsAction = async (
  queryClient: QueryClient,
  input: TanStackQueryDevtoolsActionInput
) => {
  switch (input.type) {
    case 'CLEAR_QUERY_CACHE': {
      const queryCountBefore = queryClient.getQueryCache().getAll().length;
      queryClient.getQueryCache().clear();
      return {
        applied: true,
        action: input.type,
        cleared: true,
        queryCountBefore,
        queryCountAfter: queryClient.getQueryCache().getAll().length,
      };
    }

    case 'CLEAR_MUTATION_CACHE': {
      const mutationCountBefore =
        queryClient.getMutationCache().getAll().length;
      queryClient.getMutationCache().clear();
      return {
        applied: true,
        action: input.type,
        cleared: true,
        mutationCountBefore,
        mutationCountAfter: queryClient.getMutationCache().getAll().length,
      };
    }

    case 'TRIGGER_ERROR': {
      const activeQuery = getActiveQuery(queryClient, input.queryHash);
      const previousQueryOptions = activeQuery.options;
      const error = new Error('Unknown error from devtools');

      activeQuery.setState({
        status: 'error',
        error,
        fetchMeta: {
          ...activeQuery.state.fetchMeta,
          // @ts-expect-error This does exist
          __previousQueryOptions: previousQueryOptions,
        },
      });

      return {
        applied: true,
        action: input.type,
        queryHash: activeQuery.queryHash,
      };
    }

    case 'RESTORE_ERROR': {
      const activeQuery = getActiveQuery(queryClient, input.queryHash);
      await queryClient.resetQueries(activeQuery);
      return {
        applied: true,
        action: input.type,
        queryHash: activeQuery.queryHash,
      };
    }

    case 'TRIGGER_LOADING': {
      const activeQuery = getActiveQuery(queryClient, input.queryHash);
      const previousQueryOptions = activeQuery.options;

      void activeQuery.fetch({
        ...previousQueryOptions,
        queryFn: () =>
          new Promise(() => {
            // Never resolve - simulates perpetual loading
          }),
        gcTime: -1,
      });

      activeQuery.setState({
        data: undefined,
        status: 'pending',
        fetchMeta: {
          ...activeQuery.state.fetchMeta,
          // @ts-expect-error This does exist
          __previousQueryOptions: previousQueryOptions,
        },
      });

      return {
        applied: true,
        action: input.type,
        queryHash: activeQuery.queryHash,
      };
    }

    case 'RESTORE_LOADING': {
      const activeQuery = getActiveQuery(queryClient, input.queryHash);
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
        void activeQuery.fetch(previousOptions);
      }

      return {
        applied: true,
        action: input.type,
        queryHash: activeQuery.queryHash,
      };
    }

    case 'RESET': {
      const activeQuery = getActiveQuery(queryClient, input.queryHash);
      await queryClient.resetQueries(activeQuery);
      return {
        applied: true,
        action: input.type,
        queryHash: activeQuery.queryHash,
      };
    }

    case 'REMOVE': {
      const activeQuery = getActiveQuery(queryClient, input.queryHash);
      queryClient.removeQueries(activeQuery);
      return {
        applied: true,
        action: input.type,
        queryHash: activeQuery.queryHash,
      };
    }

    case 'REFETCH': {
      const activeQuery = getActiveQuery(queryClient, input.queryHash);
      await activeQuery.fetch().catch(() => {
        // Ignore errors from refetch in the agent/UI bridge.
      });
      return {
        applied: true,
        action: input.type,
        queryHash: activeQuery.queryHash,
      };
    }

    case 'INVALIDATE': {
      const activeQuery = getActiveQuery(queryClient, input.queryHash);
      await queryClient.invalidateQueries(activeQuery);
      return {
        applied: true,
        action: input.type,
        queryHash: activeQuery.queryHash,
      };
    }
  }
};
