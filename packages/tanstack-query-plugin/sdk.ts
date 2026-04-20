import { defineAgentToolDescriptors } from '@rozenite/agent-shared';
import {
  TANSTACK_QUERY_AGENT_PLUGIN_ID,
  tanstackQueryToolDefinitions,
} from './src/shared/agent-tools.js';

export {
  TANSTACK_QUERY_AGENT_PLUGIN_ID,
  tanstackQueryToolDefinitions,
};

export const tanstackQueryTools = defineAgentToolDescriptors(
  TANSTACK_QUERY_AGENT_PLUGIN_ID,
  tanstackQueryToolDefinitions,
);

export type {
  TanStackQueryActionResult,
  TanStackQueryAgentMutationIdInput,
  TanStackQueryAgentOnlineStatusInput,
  TanStackQueryAgentPaginationInput,
  TanStackQueryAgentQueryHashInput,
  TanStackQueryAgentQueryToggleInput,
  TanStackQueryAgentSafeValue,
  TanStackQueryCacheSummary,
  TanStackQueryClearMutationCacheArgs,
  TanStackQueryClearMutationCacheResult,
  TanStackQueryClearQueryCacheArgs,
  TanStackQueryClearQueryCacheResult,
  TanStackQueryGetCacheSummaryArgs,
  TanStackQueryGetCacheSummaryResult,
  TanStackQueryGetMutationDetailsArgs,
  TanStackQueryGetMutationDetailsResult,
  TanStackQueryGetOnlineStatusArgs,
  TanStackQueryGetOnlineStatusResult,
  TanStackQueryGetQueryDetailsArgs,
  TanStackQueryGetQueryDetailsResult,
  TanStackQueryInvalidateQueryArgs,
  TanStackQueryListMutationsArgs,
  TanStackQueryListMutationsResult,
  TanStackQueryListQueriesArgs,
  TanStackQueryListQueriesResult,
  TanStackQueryMutationOptionsSummary,
  TanStackQueryMutationSummary,
  TanStackQueryObserverOptionsSummary,
  TanStackQueryPage,
  TanStackQueryQuerySummary,
  TanStackQueryRefetchQueryArgs,
  TanStackQueryRemoveQueryArgs,
  TanStackQueryResetQueryArgs,
  TanStackQuerySetOnlineStatusArgs,
  TanStackQuerySetOnlineStatusResult,
  TanStackQuerySetQueryErrorArgs,
  TanStackQuerySetQueryLoadingArgs,
} from './src/shared/agent-tools.js';
