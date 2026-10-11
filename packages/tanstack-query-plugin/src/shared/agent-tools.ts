import {
  defineAgentToolContract,
  definePaginatedAgentToolContract,
  type AgentToolContract,
  type JSONSchema7,
} from '@rozenite/agent-shared';
import type { FetchStatus, MutationStatus, QueryStatus } from '@tanstack/react-query';
import type { applyTanStackQueryDevtoolsAction } from '../react-native/devtools-actions';
import type { BoundedValueArgs } from './bounded-value';

export const TANSTACK_QUERY_AGENT_PLUGIN_ID = '@rozenite/tanstack-query-plugin';

export type TanStackQueryAgentPaginationInput = {
  limit?: number;
  cursor?: string;
};

export type TanStackQueryAgentQueryHashInput = {
  queryHash: string;
};

export type TanStackQueryAgentQueryToggleInput = TanStackQueryAgentQueryHashInput & {
  enabled: boolean;
};

export type TanStackQueryAgentMutationIdInput = {
  mutationId: number;
};

export type TanStackQueryAgentOnlineStatusInput = {
  online: boolean;
};

export type TanStackQueryAgentSafeValue =
  | null
  | boolean
  | number
  | string
  | TanStackQueryAgentSafeValue[]
  | { [key: string]: TanStackQueryAgentSafeValue };

export type TanStackQueryCacheSummary = {
  online: boolean;
  queries: {
    total: number;
    active: number;
    fetching: number;
    pending: number;
    success: number;
    error: number;
    invalidated: number;
  };
  mutations: {
    total: number;
    pending: number;
    success: number;
    error: number;
    paused: number;
  };
};

export type TanStackQueryPage = {
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
};

export type TanStackQueryQuerySummary = {
  queryHash: string;
  queryKey: TanStackQueryAgentSafeValue;
  status: QueryStatus;
  fetchStatus: FetchStatus;
  observersCount: number;
  isInvalidated: boolean;
  dataUpdatedAt: number;
  errorUpdatedAt: number;
  hasData: boolean;
  hasError: boolean;
};

export type TanStackQueryObserverOptionsSummary = {
  enabled: TanStackQueryAgentSafeValue;
  networkMode: TanStackQueryAgentSafeValue;
  staleTime: TanStackQueryAgentSafeValue;
  gcTime: TanStackQueryAgentSafeValue;
  retry: TanStackQueryAgentSafeValue;
  retryDelay: TanStackQueryAgentSafeValue;
  refetchInterval: TanStackQueryAgentSafeValue;
  refetchOnMount: TanStackQueryAgentSafeValue;
  refetchOnReconnect: TanStackQueryAgentSafeValue;
  refetchOnWindowFocus: TanStackQueryAgentSafeValue;
  subscribed: TanStackQueryAgentSafeValue;
  meta: TanStackQueryAgentSafeValue;
  hasQueryFn: boolean;
  hasSelect: boolean;
  hasPlaceholderData: boolean;
  hasInitialData: boolean;
};

export type TanStackQueryListQueriesResult = TanStackQueryCacheSummary & {
  total: number;
  items: TanStackQueryQuerySummary[];
  page: TanStackQueryPage;
};

export type TanStackQueryGetQueryDetailsResult = {
  summary: TanStackQueryCacheSummary;
  query: TanStackQueryQuerySummary & {
    /** Query data (or the sub-tree at `path`), cut to `maxDepth` / `maxValueLength`. */
    data: TanStackQueryAgentSafeValue;
    error: TanStackQueryAgentSafeValue;
    observers: Array<{
      queryHash: string;
      options: TanStackQueryObserverOptionsSummary | null;
    }>;
  };
  /** The `path` a value was narrowed to, when one was given. */
  path?: string;
  /** Whether any value in `data` or `error` was cut. */
  truncated: boolean;
};

export type TanStackQueryActionResult = Awaited<
  ReturnType<typeof applyTanStackQueryDevtoolsAction>
>;

export type TanStackQueryMutationSummary = {
  mutationId: number;
  mutationKey: TanStackQueryAgentSafeValue;
  status: MutationStatus;
  isPaused: boolean;
  submittedAt: number;
  failureCount: number;
  hasData: boolean;
  hasError: boolean;
};

export type TanStackQueryMutationOptionsSummary = {
  mutationKey: TanStackQueryAgentSafeValue;
  networkMode: TanStackQueryAgentSafeValue;
  gcTime: TanStackQueryAgentSafeValue;
  retry: TanStackQueryAgentSafeValue;
  retryDelay: TanStackQueryAgentSafeValue;
  meta: TanStackQueryAgentSafeValue;
  scope: TanStackQueryAgentSafeValue;
  hasMutationFn: boolean;
  hasOnMutate: boolean;
  hasOnSuccess: boolean;
  hasOnError: boolean;
  hasOnSettled: boolean;
};

export type TanStackQueryListMutationsResult = TanStackQueryCacheSummary & {
  total: number;
  items: TanStackQueryMutationSummary[];
  page: TanStackQueryPage;
};

export type TanStackQueryGetMutationDetailsResult = {
  summary: TanStackQueryCacheSummary;
  mutation: TanStackQueryMutationSummary & {
    variables: TanStackQueryAgentSafeValue;
    data: TanStackQueryAgentSafeValue;
    error: TanStackQueryAgentSafeValue;
    context: TanStackQueryAgentSafeValue;
    failureReason: TanStackQueryAgentSafeValue;
    options: TanStackQueryMutationOptionsSummary;
  };
  /** The `path` a value was narrowed to, when one was given. */
  path?: string;
  /** Whether any of `variables`, `data`, `error`, `context` or `failureReason` was cut. */
  truncated: boolean;
};

export type TanStackQueryGetCacheSummaryArgs = undefined;
export type TanStackQueryGetCacheSummaryResult = TanStackQueryCacheSummary;
export type TanStackQueryGetOnlineStatusArgs = undefined;
export type TanStackQueryGetOnlineStatusResult = { online: boolean };
export type TanStackQuerySetOnlineStatusArgs = TanStackQueryAgentOnlineStatusInput;
export type TanStackQuerySetOnlineStatusResult = { online: boolean };
export type TanStackQueryListQueriesArgs = TanStackQueryAgentPaginationInput;
export type TanStackQueryBoundedValueArgs = BoundedValueArgs;
export type TanStackQueryGetQueryDetailsArgs = TanStackQueryAgentQueryHashInput & BoundedValueArgs;
export type TanStackQueryRefetchQueryArgs = TanStackQueryAgentQueryHashInput;
export type TanStackQuerySetQueryLoadingArgs = TanStackQueryAgentQueryToggleInput;
export type TanStackQuerySetQueryErrorArgs = TanStackQueryAgentQueryToggleInput;
export type TanStackQueryInvalidateQueryArgs = TanStackQueryAgentQueryHashInput;
export type TanStackQueryResetQueryArgs = TanStackQueryAgentQueryHashInput;
export type TanStackQueryRemoveQueryArgs = TanStackQueryAgentQueryHashInput;
export type TanStackQueryClearQueryCacheArgs = undefined;
export type TanStackQueryClearQueryCacheResult = TanStackQueryActionResult;
export type TanStackQueryListMutationsArgs = TanStackQueryAgentPaginationInput;
export type TanStackQueryGetMutationDetailsArgs = TanStackQueryAgentMutationIdInput &
  BoundedValueArgs;
export type TanStackQueryClearMutationCacheArgs = undefined;
export type TanStackQueryClearMutationCacheResult = TanStackQueryActionResult;

const queryActionProperties = {
  queryHash: {
    type: 'string',
    description: 'TanStack Query queryHash identifying the query.',
  },
} satisfies Record<string, JSONSchema7>;

const mutationActionProperties = {
  mutationId: {
    type: 'number',
    description: 'TanStack Query mutationId identifying the mutation.',
  },
} satisfies Record<string, JSONSchema7>;

const paginationProperties = {
  limit: {
    type: 'number',
    description: 'Maximum number of items to return. Defaults to 20. Maximum 100.',
  },
  cursor: {
    type: 'string',
    description: 'Opaque pagination cursor from a previous list call.',
  },
} satisfies Record<string, JSONSchema7>;

const boundedValueProperties = {
  maxDepth: {
    type: 'integer',
    description:
      'Levels of nesting expanded below each returned value. Deeper objects and arrays collapse to "[object(N keys)]" / "[array(N)]". Defaults to 4, max 64.',
  },
  maxValueLength: {
    type: 'integer',
    description:
      'Truncate string values longer than this, marking the cut with "[+N chars]". Defaults to 512.',
  },
} satisfies Record<string, JSONSchema7>;

const emptyInputSchema: JSONSchema7 = {
  type: 'object',
  properties: {},
};

export const tanstackQueryToolDefinitions = {
  getCacheSummary: defineAgentToolContract<
    TanStackQueryGetCacheSummaryArgs,
    TanStackQueryGetCacheSummaryResult
  >({
    name: 'get-cache-summary',
    description: 'Return aggregate TanStack Query cache health and count information.',
    inputSchema: emptyInputSchema,
  }),
  getOnlineStatus: defineAgentToolContract<
    TanStackQueryGetOnlineStatusArgs,
    TanStackQueryGetOnlineStatusResult
  >({
    name: 'get-online-status',
    description: 'Return the current TanStack Query onlineManager status.',
    inputSchema: emptyInputSchema,
  }),
  setOnlineStatus: defineAgentToolContract<
    TanStackQuerySetOnlineStatusArgs,
    TanStackQuerySetOnlineStatusResult
  >({
    name: 'set-online-status',
    description: 'Set the TanStack Query onlineManager status for testing offline/online behavior.',
    inputSchema: {
      type: 'object',
      properties: {
        online: {
          type: 'boolean',
          description: 'Whether the TanStack Query onlineManager should be online.',
        },
      },
      required: ['online'],
    },
  }),
  listQueries: definePaginatedAgentToolContract<
    TanStackQueryListQueriesArgs,
    TanStackQueryListQueriesResult
  >({
    name: 'list-queries',
    description: 'List TanStack Query query summaries using cursor pagination.',
    inputSchema: {
      type: 'object',
      properties: paginationProperties,
    },
    pagination: {
      kind: 'cursor',
      fields: [
        'queryHash',
        'queryKey',
        'status',
        'fetchStatus',
        'observersCount',
        'isInvalidated',
        'dataUpdatedAt',
        'errorUpdatedAt',
        'hasData',
        'hasError',
      ],
      defaultFields: ['queryHash', 'status', 'fetchStatus', 'hasError'],
    },
  }),
  getQueryDetails: defineAgentToolContract<
    TanStackQueryGetQueryDetailsArgs,
    TanStackQueryGetQueryDetailsResult
  >({
    name: 'get-query-details',
    description:
      'Return a JSON-safe TanStack Query query snapshot and observer summary. data and error are cut to maxDepth levels and maxValueLength characters per string; use path to read a deeper sub-tree.',
    inputSchema: {
      type: 'object',
      properties: {
        ...queryActionProperties,
        path: {
          type: 'string',
          description:
            'Dot path starting with "data" or "error" selecting the sub-tree to return, for example "data.items.0".',
        },
        ...boundedValueProperties,
      },
      required: ['queryHash'],
    },
  }),
  refetchQuery: defineAgentToolContract<TanStackQueryRefetchQueryArgs, TanStackQueryActionResult>({
    name: 'refetch-query',
    description: 'Refetch a TanStack Query query by queryHash.',
    inputSchema: {
      type: 'object',
      properties: queryActionProperties,
      required: ['queryHash'],
    },
  }),
  setQueryLoading: defineAgentToolContract<
    TanStackQuerySetQueryLoadingArgs,
    TanStackQueryActionResult
  >({
    name: 'set-query-loading',
    description:
      'Enable or disable TanStack Query loading-state simulation for a query by queryHash.',
    inputSchema: {
      type: 'object',
      properties: {
        ...queryActionProperties,
        enabled: {
          type: 'boolean',
          description: 'Whether the loading-state simulation should be enabled.',
        },
      },
      required: ['queryHash', 'enabled'],
    },
  }),
  setQueryError: defineAgentToolContract<TanStackQuerySetQueryErrorArgs, TanStackQueryActionResult>(
    {
      name: 'set-query-error',
      description:
        'Enable or disable TanStack Query error-state simulation for a query by queryHash.',
      inputSchema: {
        type: 'object',
        properties: {
          ...queryActionProperties,
          enabled: {
            type: 'boolean',
            description: 'Whether the error-state simulation should be enabled.',
          },
        },
        required: ['queryHash', 'enabled'],
      },
    },
  ),
  invalidateQuery: defineAgentToolContract<
    TanStackQueryInvalidateQueryArgs,
    TanStackQueryActionResult
  >({
    name: 'invalidate-query',
    description: 'Invalidate a TanStack Query query by queryHash.',
    inputSchema: {
      type: 'object',
      properties: queryActionProperties,
      required: ['queryHash'],
    },
  }),
  resetQuery: defineAgentToolContract<TanStackQueryResetQueryArgs, TanStackQueryActionResult>({
    name: 'reset-query',
    description: 'Reset a TanStack Query query by queryHash.',
    inputSchema: {
      type: 'object',
      properties: queryActionProperties,
      required: ['queryHash'],
    },
  }),
  removeQuery: defineAgentToolContract<TanStackQueryRemoveQueryArgs, TanStackQueryActionResult>({
    name: 'remove-query',
    description: 'Remove a TanStack Query query from the cache by queryHash.',
    inputSchema: {
      type: 'object',
      properties: queryActionProperties,
      required: ['queryHash'],
    },
  }),
  clearQueryCache: defineAgentToolContract<
    TanStackQueryClearQueryCacheArgs,
    TanStackQueryClearQueryCacheResult
  >({
    name: 'clear-query-cache',
    description: 'Clear the full TanStack Query query cache.',
    inputSchema: emptyInputSchema,
  }),
  listMutations: definePaginatedAgentToolContract<
    TanStackQueryListMutationsArgs,
    TanStackQueryListMutationsResult
  >({
    name: 'list-mutations',
    description: 'List TanStack Query mutation summaries using cursor pagination.',
    inputSchema: {
      type: 'object',
      properties: paginationProperties,
    },
    pagination: {
      kind: 'cursor',
      fields: [
        'mutationId',
        'mutationKey',
        'status',
        'isPaused',
        'submittedAt',
        'failureCount',
        'hasData',
        'hasError',
      ],
      defaultFields: ['mutationId', 'mutationKey', 'status', 'hasError'],
    },
  }),
  getMutationDetails: defineAgentToolContract<
    TanStackQueryGetMutationDetailsArgs,
    TanStackQueryGetMutationDetailsResult
  >({
    name: 'get-mutation-details',
    description:
      'Return a JSON-safe TanStack Query mutation snapshot for a mutationId. variables, data, error, context and failureReason are cut to maxDepth levels and maxValueLength characters per string; use path to read a deeper sub-tree.',
    inputSchema: {
      type: 'object',
      properties: {
        ...mutationActionProperties,
        path: {
          type: 'string',
          description:
            'Dot path starting with "variables", "data", "error", "context" or "failureReason" selecting the sub-tree to return, for example "variables.id".',
        },
        ...boundedValueProperties,
      },
      required: ['mutationId'],
    },
  }),
  clearMutationCache: defineAgentToolContract<
    TanStackQueryClearMutationCacheArgs,
    TanStackQueryClearMutationCacheResult
  >({
    name: 'clear-mutation-cache',
    description: 'Clear the full TanStack Query mutation cache.',
    inputSchema: emptyInputSchema,
  }),
} as const satisfies Record<string, AgentToolContract<unknown, unknown>>;
