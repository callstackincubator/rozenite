import type {
  Mutation,
  MutationObserverOptions,
  MutationState,
  Query,
  QueryClient,
} from '@tanstack/react-query';
import { onlineManager } from '@tanstack/react-query';
import { paginateArray } from '@rozenite/agent-shared';
import { applyTanStackQueryDevtoolsAction } from '../devtools-actions';
import {
  boundValue,
  normalizeBoundedValueArgs,
  selectValuePath,
  type BoundedValueArgs,
} from '../../shared/bounded-value';
import {
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

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
};

export const serializeForAgent = (value: unknown, seen = new WeakSet<object>()): AgentSafeValue => {
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
      cause: serializeForAgent((value as Error & { cause?: unknown }).cause, seen),
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeForAgent(item, seen));
  }

  if (ArrayBuffer.isView(value)) {
    return Array.from(value as unknown as ArrayLike<number>).map((item) =>
      typeof item === 'number' ? item : Number(item),
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
export const getMutationDetailsTool = tanstackQueryToolDefinitions.getMutationDetails;
export const clearMutationCacheTool = tanstackQueryToolDefinitions.clearMutationCache;
export const TANSTACK_QUERY_AGENT_TOOLS = Object.values(tanstackQueryToolDefinitions);

const pickObserverOptionsSummary = (
  options: Record<string, unknown> | undefined,
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
  options: MutationObserverOptions<unknown, Error, unknown, unknown>,
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
  b: Mutation<unknown, Error, unknown, unknown>,
) => {
  return b.state.submittedAt - a.state.submittedAt || b.mutationId - a.mutationId;
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

const getMutationStatus = (state: MutationState<unknown, Error, unknown, unknown>) => {
  return state.status;
};

const getMutationSummary = (mutation: Mutation<unknown, Error, unknown, unknown>) => {
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

/**
 * Applies `path`, `maxDepth` and `maxValueLength` to the named value fields
 * of a details result. `path` must start with one of `fields`.
 */
const createValueBounder = <TField extends string>(
  fields: readonly TField[],
  args: BoundedValueArgs,
) => {
  const bounds = normalizeBoundedValueArgs(args);
  const pathField = bounds.path?.[0];
  if (bounds.path && !fields.includes(pathField as TField)) {
    throw new Error(`"path" must start with ${fields.map((field) => `"${field}"`).join(', ')}.`);
  }

  let truncated = false;
  return {
    bound(field: TField, value: AgentSafeValue): AgentSafeValue {
      const selected =
        bounds.path && pathField === field
          ? selectValuePath(value, bounds.path.slice(1), [field])
          : value;
      const result = boundValue(selected, bounds);
      truncated = truncated || result.truncated;
      return result.value as AgentSafeValue;
    },
    finish() {
      return {
        ...(bounds.path ? { path: bounds.path.join('.') } : {}),
        truncated,
      };
    },
  };
};

const QUERY_VALUE_FIELDS = ['data', 'error'] as const;
const MUTATION_VALUE_FIELDS = ['variables', 'data', 'error', 'context', 'failureReason'] as const;

const resolveQuery = (queryClient: QueryClient, queryHash: string) => {
  const query = queryClient.getQueryCache().get(queryHash);
  if (!query) {
    const available = queryClient
      .getQueryCache()
      .getAll()
      .map((entry) => entry.queryHash)
      .join(', ');
    throw new Error(`Unknown queryHash "${queryHash}". Available: ${available || '(none)'}`);
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
    throw new Error(`Unknown mutationId "${mutationId}". Available: ${available || '(none)'}`);
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
      fetching: queries.filter((query) => query.state.fetchStatus === 'fetching').length,
      pending: queries.filter((query) => query.state.status === 'pending').length,
      success: queries.filter((query) => query.state.status === 'success').length,
      error: queries.filter((query) => query.state.status === 'error').length,
      invalidated: queries.filter((query) => query.state.isInvalidated).length,
    },
    mutations: {
      total: mutations.length,
      pending: mutations.filter((mutation) => mutation.state.status === 'pending').length,
      success: mutations.filter((mutation) => mutation.state.status === 'success').length,
      error: mutations.filter((mutation) => mutation.state.status === 'error').length,
      paused: mutations.filter((mutation) => mutation.state.isPaused).length,
    },
  };
};

export const createTanStackQueryAgentController = (queryClient: QueryClient) => {
  return {
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
        ...paginateArray(queries.map(getQuerySummary), {
          keyOf: (row) => row.queryHash,
          limit: input.limit,
          cursor: input.cursor,
          scope: 'queries',
        }),
      };
    },

    getQueryDetails({ queryHash, ...boundArgs }: QueryHashInput & BoundedValueArgs) {
      const bounder = createValueBounder(QUERY_VALUE_FIELDS, boundArgs);
      const query = resolveQuery(queryClient, queryHash);

      return {
        summary: buildTanStackQueryCacheSummary(queryClient),
        query: {
          ...getQuerySummary(query),
          data: bounder.bound('data', serializeForAgent(query.state.data)),
          error: bounder.bound('error', serializeForAgent(query.state.error)),
          observers: query.observers.map((observer) => ({
            queryHash: query.queryHash,
            options: pickObserverOptionsSummary(
              observer.options as unknown as Record<string, unknown>,
            ),
          })),
        },
        ...bounder.finish(),
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
      const mutations = [...queryClient.getMutationCache().getAll()].sort(compareMutations);

      return {
        ...buildTanStackQueryCacheSummary(queryClient),
        total: mutations.length,
        ...paginateArray(mutations.map(getMutationSummary), {
          keyOf: (row) => row.mutationId,
          limit: input.limit,
          cursor: input.cursor,
          scope: 'mutations',
        }),
      };
    },

    getMutationDetails({ mutationId, ...boundArgs }: MutationIdInput & BoundedValueArgs) {
      const bounder = createValueBounder(MUTATION_VALUE_FIELDS, boundArgs);
      const mutation = resolveMutation(queryClient, mutationId);

      return {
        summary: buildTanStackQueryCacheSummary(queryClient),
        mutation: {
          ...getMutationSummary(mutation),
          variables: bounder.bound('variables', serializeForAgent(mutation.state.variables)),
          data: bounder.bound('data', serializeForAgent(mutation.state.data)),
          error: bounder.bound('error', serializeForAgent(mutation.state.error)),
          context: bounder.bound('context', serializeForAgent(mutation.state.context)),
          failureReason: bounder.bound(
            'failureReason',
            serializeForAgent(mutation.state.failureReason),
          ),
          options: pickMutationOptionsSummary(mutation.options),
        },
        ...bounder.finish(),
      };
    },

    async clearMutationCache() {
      return applyTanStackQueryDevtoolsAction(queryClient, {
        type: 'CLEAR_MUTATION_CACHE',
      });
    },
  };
};

export type TanStackQueryAgentController = ReturnType<typeof createTanStackQueryAgentController>;
