import {
  Query,
  QueryClient,
  QueryKey,
  QueryState,
} from '@tanstack/react-query';

type QuerySetState = Query['setState'];
type QueryClientSetQueryData = QueryClient['setQueryData'];

type SyncQueryDataPayload = {
  queryHash: string;
  data: unknown;
};

type QueryDataSyncHandler = (payload: SyncQueryDataPayload) => void;

const originalQuerySetStateMap = new WeakMap<Query, QuerySetState>();
const originalSetQueryDataMap = new WeakMap<
  QueryClient,
  QueryClientSetQueryData
>();
const instrumentedQueryClients = new WeakSet<QueryClient>();
const instrumentedQueries = new WeakSet<Query>();
const queryClientHandlers = new WeakMap<
  QueryClient,
  QueryDataSyncHandler | undefined
>();
const queryHandlers = new WeakMap<Query, QueryDataSyncHandler | undefined>();

const getOriginalQuerySetState = (query: Query): QuerySetState => {
  return originalQuerySetStateMap.get(query) ?? query.setState.bind(query);
};

const emitIfDataChanged = (
  query: Query,
  previousData: unknown,
  handler?: QueryDataSyncHandler,
) => {
  if (!handler || Object.is(previousData, query.state.data)) {
    return;
  }

  handler({
    queryHash: query.queryHash,
    data: query.state.data,
  });
};

const isDataOnlyStateUpdate = (
  previousState: QueryState,
  nextState: Partial<QueryState>,
) => {
  if (!('data' in nextState)) {
    return false;
  }

  const changedKeys = Object.keys(nextState).filter((key) => {
    const typedKey = key as keyof QueryState;
    return !Object.is(previousState[typedKey], nextState[typedKey]);
  }) as Array<keyof QueryState>;

  return changedKeys.every((key) => key === 'data');
};

export const applyRemoteQueryState = (
  query: Query,
  state: Partial<QueryState>,
) => {
  const originalSetState = getOriginalQuerySetState(query);
  originalSetState(state);
};

export const instrumentQuery = (
  query: Query,
  handler?: QueryDataSyncHandler,
) => {
  queryHandlers.set(query, handler);

  if (instrumentedQueries.has(query)) {
    return query;
  }

  const originalSetState = query.setState.bind(query);
  originalQuerySetStateMap.set(query, originalSetState);

  query.setState = ((state) => {
    const shouldEmit = isDataOnlyStateUpdate(query.state, state);
    const previousData = query.state.data;
    const result = originalSetState(state);

    if (shouldEmit) {
      emitIfDataChanged(query, previousData, queryHandlers.get(query));
    }

    return result;
  }) as QuerySetState;

  instrumentedQueries.add(query);
  return query;
};

const resolveQueryHash = (queryClient: QueryClient, queryKey: QueryKey) => {
  return queryClient.getQueryCache().find({ queryKey })?.queryHash;
};

export const instrumentQueryClient = (
  queryClient: QueryClient,
  handler?: QueryDataSyncHandler,
) => {
  queryClientHandlers.set(queryClient, handler);

  if (instrumentedQueryClients.has(queryClient)) {
    queryClient
      .getQueryCache()
      .getAll()
      .forEach((query) => {
        instrumentQuery(query, handler);
      });
    return queryClient;
  }

  const originalSetQueryData = queryClient.setQueryData.bind(queryClient);
  originalSetQueryDataMap.set(queryClient, originalSetQueryData);

  queryClient.setQueryData = ((queryKey, updater, options) => {
    const result = originalSetQueryData(queryKey, updater, options);
    const query = queryClient.getQueryCache().find({ queryKey });
    const activeQueryClientHandler = queryClientHandlers.get(queryClient);

    if (query) {
      instrumentQuery(query, activeQueryClientHandler);
      const queryHash = resolveQueryHash(queryClient, queryKey);
      const activeHandler = queryHandlers.get(query);

      if (activeHandler && queryHash) {
        activeHandler({
          queryHash,
          data: query.state.data,
        });
      }
    }

    return result;
  }) as QueryClientSetQueryData;

  queryClient
    .getQueryCache()
    .getAll()
    .forEach((query) => {
      instrumentQuery(query, handler);
    });

  instrumentedQueryClients.add(queryClient);
  return queryClient;
};
