import type {
  JSONSchema7,
} from '@rozenite/agent-bridge';
import type {
  Mutation,
  MutationCacheNotifyEvent,
  MutationObserverOptions,
  MutationState,
  Query,
  QueryCacheNotifyEvent,
  QueryClient,
} from '@tanstack/react-query';
import { onlineManager } from '@tanstack/react-query';
import { applyTanStackQueryDevtoolsAction } from '../devtools-actions';
import {
  TANSTACK_QUERY_AGENT_PLUGIN_ID,
  tanstackQueryToolDefinitions,
  type TanStackQueryAgentMutationIdInput as MutationIdInput,
  type TanStackQueryAgentOnlineStatusInput as OnlineStatusInput,
  type TanStackQueryAgentPaginationInput as PaginationInput,
  type TanStackQueryAgentQueryHashInput as QueryHashInput,
  type TanStackQueryAgentQueryToggleInput as QueryToggleInput,
  type TanStackQueryAgentSafeValue as AgentSafeValue,
  type TanStackQueryMutationOptionsSummary,
  type TanStackQueryObserverOptionsSummary,
} from '../../shared/agent-tools';

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

type CursorKind = 'queries' | 'mutations';

type CursorState = {
  queriesGeneration: number;
  mutationsGeneration: number;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return (
    !!value &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  );
};

export const serializeForAgent = (
  value: unknown,
  seen = new WeakSet<object>()
): AgentSafeValue => {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'function' || typeof value === 'symbol') {
    return `[non-serializable:${typeof value}]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? null,
      cause: serializeForAgent(
        (value as Error & { cause?: unknown }).cause,
        seen
      ),
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeForAgent(item, seen));
  }

  if (ArrayBuffer.isView(value)) {
    return Array.from(value as unknown as ArrayLike<number>).map((item) =>
      typeof item === 'number' ? item : Number(item)
    );
  }

  if (value instanceof ArrayBuffer) {
    return Array.from(new Uint8Array(value));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[circular]';
    }

    seen.add(value);

    if (!isPlainObject(value)) {
      return `[non-serializable:${value.constructor?.name ?? 'Object'}]`;
    }

    const entries = Object.entries(value).map(([key, nestedValue]) => [
      key,
      serializeForAgent(nestedValue, seen),
    ]);

    return Object.fromEntries(entries);
  }

  return String(value);
};

const sanitizeLimit = (limit?: number) => {
  if (
    typeof limit !== 'number' ||
    !Number.isFinite(limit) ||
    !Number.isInteger(limit) ||
    limit < 1
  ) {
    return DEFAULT_PAGE_LIMIT;
  }

  return Math.min(limit, MAX_PAGE_LIMIT);
};

const encodeCursor = (
  kind: CursorKind,
  generation: number,
  offset: number
): string => {
  return `${kind}:${generation}:${offset}`;
};

const decodeCursor = (
  cursor: string,
  kind: CursorKind,
  generation: number
): number => {
  const [cursorKind, rawGeneration, rawOffset] = cursor.split(':', 3);
  if (cursorKind !== kind || !rawGeneration || !rawOffset) {
    throw new Error(
      'Cursor does not match the requested listing. Run the command again.'
    );
  }

  const cursorGeneration = Number(rawGeneration);
  const offset = Number(rawOffset);

  if (!Number.isInteger(cursorGeneration) || cursorGeneration !== generation) {
    throw new Error(
      'Cursor does not match the requested listing. Run the command again.'
    );
  }

  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('Cursor is invalid. Run the command again.');
  }

  return offset;
};

const paginate = <T>(
  rows: T[],
  kind: CursorKind,
  generation: number,
  input: PaginationInput
) => {
  const limit = sanitizeLimit(input.limit);
  const startIndex = input.cursor
    ? decodeCursor(input.cursor, kind, generation)
    : 0;
  const endIndex = Math.min(startIndex + limit, rows.length);
  const hasMore = endIndex < rows.length;

  return {
    items: rows.slice(startIndex, endIndex),
    page: {
      limit,
      hasMore,
      ...(hasMore
        ? { nextCursor: encodeCursor(kind, generation, endIndex) }
        : {}),
    },
  };
};

export const getCacheSummaryTool = tanstackQueryToolDefinitions.getCacheSummary;
export const getOnlineStatusTool = tanstackQueryToolDefinitions.getOnlineStatus;
export const setOnlineStatusTool = tanstackQueryToolDefinitions.setOnlineStatus;
export const listQueriesTool = tanstackQueryToolDefinitions.listQueries;
export const getQueryDetailsTool = tanstackQueryToolDefinitions.getQueryDetails;
export const refetchQueryTool = tanstackQueryToolDefinitions.refetchQuery;
export const setQueryLoadingTool = tanstackQueryToolDefinitions.setQueryLoading;
export const setQueryErrorTool = tanstackQueryToolDefinitions.setQueryError;
export const invalidateQueryTool = tanstackQueryToolDefinitions.invalidateQuery;
export const resetQueryTool = tanstackQueryToolDefinitions.resetQuery;
export const removeQueryTool = tanstackQueryToolDefinitions.removeQuery;
export const clearQueryCacheTool = tanstackQueryToolDefinitions.clearQueryCache;
export const listMutationsTool = tanstackQueryToolDefinitions.listMutations;
export const getMutationDetailsTool =
  tanstackQueryToolDefinitions.getMutationDetails;
export const clearMutationCacheTool =
  tanstackQueryToolDefinitions.clearMutationCache;
export const TANSTACK_QUERY_AGENT_TOOLS = Object.values(
  tanstackQueryToolDefinitions,
);

const pickObserverOptionsSummary = (
  options: Record<string, unknown> | undefined
): TanStackQueryObserverOptionsSummary | null => {
  if (!options) {
    return null;
  }

  return {
    enabled: serializeForAgent(options.enabled),
    networkMode: serializeForAgent(options.networkMode),
    staleTime: serializeForAgent(options.staleTime),
    gcTime: serializeForAgent(options.gcTime),
    retry: serializeForAgent(options.retry),
    retryDelay: serializeForAgent(options.retryDelay),
    refetchInterval: serializeForAgent(options.refetchInterval),
    refetchOnMount: serializeForAgent(options.refetchOnMount),
    refetchOnReconnect: serializeForAgent(options.refetchOnReconnect),
    refetchOnWindowFocus: serializeForAgent(options.refetchOnWindowFocus),
    subscribed: serializeForAgent(options.subscribed),
    meta: serializeForAgent(options.meta),
    hasQueryFn: typeof options.queryFn === 'function',
    hasSelect: typeof options.select === 'function',
    hasPlaceholderData: 'placeholderData' in options,
    hasInitialData: 'initialData' in options,
  };
};

const pickMutationOptionsSummary = (
  options: MutationObserverOptions<unknown, Error, unknown, unknown>
): TanStackQueryMutationOptionsSummary => {
  return {
    mutationKey: serializeForAgent(options.mutationKey),
    networkMode: serializeForAgent(options.networkMode),
    gcTime: serializeForAgent(options.gcTime),
    retry: serializeForAgent(options.retry),
    retryDelay: serializeForAgent(options.retryDelay),
    meta: serializeForAgent(options.meta),
    scope: serializeForAgent(options.scope),
    hasMutationFn: typeof options.mutationFn === 'function',
    hasOnMutate: typeof options.onMutate === 'function',
    hasOnSuccess: typeof options.onSuccess === 'function',
    hasOnError: typeof options.onError === 'function',
    hasOnSettled: typeof options.onSettled === 'function',
  };
};

const getQuerySortTimestamp = (query: Query) => {
  return Math.max(query.state.dataUpdatedAt, query.state.errorUpdatedAt);
};

const compareQueries = (a: Query, b: Query) => {
  return (
    getQuerySortTimestamp(b) - getQuerySortTimestamp(a) ||
    b.getObserversCount() - a.getObserversCount() ||
    String(b.queryHash).localeCompare(String(a.queryHash))
  );
};

const compareMutations = (
  a: Mutation<unknown, Error, unknown, unknown>,
  b: Mutation<unknown, Error, unknown, unknown>
) => {
  return (
    b.state.submittedAt - a.state.submittedAt ||
    b.mutationId - a.mutationId
  );
};

const getQuerySummary = (query: Query) => {
  return {
    queryHash: query.queryHash,
    queryKey: serializeForAgent(query.queryKey),
    status: query.state.status,
    fetchStatus: query.state.fetchStatus,
    observersCount: query.getObserversCount(),
    isInvalidated: query.state.isInvalidated,
    dataUpdatedAt: query.state.dataUpdatedAt,
    errorUpdatedAt: query.state.errorUpdatedAt,
    hasData: query.state.data !== undefined,
    hasError: query.state.error != null,
  };
};

const getMutationStatus = (
  state: MutationState<unknown, Error, unknown, unknown>
) => {
  return state.status;
};

const getMutationSummary = (
  mutation: Mutation<unknown, Error, unknown, unknown>
) => {
  return {
    mutationId: mutation.mutationId,
    mutationKey: serializeForAgent(mutation.options.mutationKey),
    status: getMutationStatus(mutation.state),
    isPaused: mutation.state.isPaused,
    submittedAt: mutation.state.submittedAt,
    failureCount: mutation.state.failureCount,
    hasData: mutation.state.data !== undefined,
    hasError: mutation.state.error != null,
  };
};

const resolveQuery = (queryClient: QueryClient, queryHash: string) => {
  const query = queryClient.getQueryCache().get(queryHash);
  if (!query) {
    const available = queryClient
      .getQueryCache()
      .getAll()
      .map((entry) => entry.queryHash)
      .join(', ');
    throw new Error(
      `Unknown queryHash "${queryHash}". Available: ${available || '(none)'}`
    );
  }

  return query;
};

const resolveMutation = (queryClient: QueryClient, mutationId: number) => {
  const mutation = queryClient
    .getMutationCache()
    .getAll()
    .find((entry) => entry.mutationId === mutationId);

  if (!mutation) {
    const available = queryClient
      .getMutationCache()
      .getAll()
      .map((entry) => entry.mutationId)
      .join(', ');
    throw new Error(
      `Unknown mutationId "${mutationId}". Available: ${available || '(none)'}`
    );
  }

  return mutation;
};

export const buildTanStackQueryCacheSummary = (queryClient: QueryClient) => {
  const queries = queryClient.getQueryCache().getAll();
  const mutations = queryClient.getMutationCache().getAll();

  return {
    online: onlineManager.isOnline(),
    queries: {
      total: queries.length,
      active: queries.filter((query) => query.getObserversCount() > 0).length,
      fetching: queries.filter(
        (query) => query.state.fetchStatus === 'fetching'
      ).length,
      pending: queries.filter((query) => query.state.status === 'pending')
        .length,
      success: queries.filter((query) => query.state.status === 'success')
        .length,
      error: queries.filter((query) => query.state.status === 'error').length,
      invalidated: queries.filter((query) => query.state.isInvalidated).length,
    },
    mutations: {
      total: mutations.length,
      pending: mutations.filter(
        (mutation) => mutation.state.status === 'pending'
      ).length,
      success: mutations.filter(
        (mutation) => mutation.state.status === 'success'
      ).length,
      error: mutations.filter((mutation) => mutation.state.status === 'error')
        .length,
      paused: mutations.filter((mutation) => mutation.state.isPaused).length,
    },
  };
};

export const createTanStackQueryAgentController = (queryClient: QueryClient) => {
  const cursorState: CursorState = {
    queriesGeneration: 0,
    mutationsGeneration: 0,
  };

  return {
    handleQueryCacheEvent(event: QueryCacheNotifyEvent) {
      if (event.type === 'added' || event.type === 'removed') {
        cursorState.queriesGeneration += 1;
      }
    },

    handleMutationCacheEvent(event: MutationCacheNotifyEvent) {
      if (event.type === 'added' || event.type === 'removed') {
        cursorState.mutationsGeneration += 1;
      }
    },

    getCacheSummary() {
      return buildTanStackQueryCacheSummary(queryClient);
    },

    getOnlineStatus() {
      return {
        online: onlineManager.isOnline(),
      };
    },

    setOnlineStatus({ online }: OnlineStatusInput) {
      onlineManager.setOnline(online);
      return {
        online: onlineManager.isOnline(),
      };
    },

    listQueries(input: PaginationInput = {}) {
      const queries = [...queryClient.getQueryCache().getAll()].sort(compareQueries);
      return {
        ...buildTanStackQueryCacheSummary(queryClient),
        total: queries.length,
        ...paginate(
          queries.map(getQuerySummary),
          'queries',
          cursorState.queriesGeneration,
          input
        ),
      };
    },

    getQueryDetails({ queryHash }: QueryHashInput) {
      const query = resolveQuery(queryClient, queryHash);

      return {
        summary: buildTanStackQueryCacheSummary(queryClient),
        query: {
          ...getQuerySummary(query),
          data: serializeForAgent(query.state.data),
          error: serializeForAgent(query.state.error),
          observers: query.observers.map((observer) => ({
            queryHash: query.queryHash,
            options: pickObserverOptionsSummary(
              observer.options as unknown as Record<string, unknown>
            ),
          })),
        },
      };
    },

    async refetchQuery({ queryHash }: QueryHashInput) {
      return applyTanStackQueryDevtoolsAction(queryClient, {
        type: 'REFETCH',
        queryHash,
      });
    },

    async setQueryLoading({ queryHash, enabled }: QueryToggleInput) {
      return applyTanStackQueryDevtoolsAction(queryClient, {
        type: enabled ? 'TRIGGER_LOADING' : 'RESTORE_LOADING',
        queryHash,
      });
    },

    async setQueryError({ queryHash, enabled }: QueryToggleInput) {
      return applyTanStackQueryDevtoolsAction(queryClient, {
        type: enabled ? 'TRIGGER_ERROR' : 'RESTORE_ERROR',
        queryHash,
      });
    },

    async invalidateQuery({ queryHash }: QueryHashInput) {
      return applyTanStackQueryDevtoolsAction(queryClient, {
        type: 'INVALIDATE',
        queryHash,
      });
    },

    async resetQuery({ queryHash }: QueryHashInput) {
      return applyTanStackQueryDevtoolsAction(queryClient, {
        type: 'RESET',
        queryHash,
      });
    },

    async removeQuery({ queryHash }: QueryHashInput) {
      return applyTanStackQueryDevtoolsAction(queryClient, {
        type: 'REMOVE',
        queryHash,
      });
    },

    async clearQueryCache() {
      return applyTanStackQueryDevtoolsAction(queryClient, {
        type: 'CLEAR_QUERY_CACHE',
      });
    },

    listMutations(input: PaginationInput = {}) {
      const mutations = [...queryClient.getMutationCache().getAll()].sort(
        compareMutations
      );

      return {
        ...buildTanStackQueryCacheSummary(queryClient),
        total: mutations.length,
        ...paginate(
          mutations.map(getMutationSummary),
          'mutations',
          cursorState.mutationsGeneration,
          input
        ),
      };
    },

    getMutationDetails({ mutationId }: MutationIdInput) {
      const mutation = resolveMutation(queryClient, mutationId);

      return {
        summary: buildTanStackQueryCacheSummary(queryClient),
        mutation: {
          ...getMutationSummary(mutation),
          variables: serializeForAgent(mutation.state.variables),
          data: serializeForAgent(mutation.state.data),
          error: serializeForAgent(mutation.state.error),
          context: serializeForAgent(mutation.state.context),
          failureReason: serializeForAgent(mutation.state.failureReason),
          options: pickMutationOptionsSummary(mutation.options),
        },
      };
    },

    async clearMutationCache() {
      return applyTanStackQueryDevtoolsAction(queryClient, {
        type: 'CLEAR_MUTATION_CACHE',
      });
    },
  };
};

export type TanStackQueryAgentController = ReturnType<
  typeof createTanStackQueryAgentController
>;
