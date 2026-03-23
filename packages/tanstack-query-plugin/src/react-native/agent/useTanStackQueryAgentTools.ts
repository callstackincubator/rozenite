import { useEffect, useMemo } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { useRozenitePluginAgentTool } from '@rozenite/agent-bridge';
import {
  clearMutationCacheTool,
  clearQueryCacheTool,
  createTanStackQueryAgentController,
  getCacheSummaryTool,
  getMutationDetailsTool,
  getOnlineStatusTool,
  getQueryDetailsTool,
  invalidateQueryTool,
  listMutationsTool,
  listQueriesTool,
  refetchQueryTool,
  removeQueryTool,
  resetQueryTool,
  setQueryErrorTool,
  setQueryLoadingTool,
  TANSTACK_QUERY_AGENT_PLUGIN_ID,
  type TanStackQueryAgentMutationIdInput,
  type TanStackQueryAgentOnlineStatusInput,
  type TanStackQueryAgentPaginationInput,
  type TanStackQueryAgentQueryHashInput,
  type TanStackQueryAgentQueryToggleInput,
  setOnlineStatusTool,
} from './tanstack-query-agent';

export const useTanStackQueryAgentTools = (queryClient: QueryClient) => {
  const controller = useMemo(
    () => createTanStackQueryAgentController(queryClient),
    [queryClient]
  );

  useEffect(() => {
    const unsubscribeQueryCache = queryClient
      .getQueryCache()
      .subscribe((event) => controller.handleQueryCacheEvent(event));
    const unsubscribeMutationCache = queryClient
      .getMutationCache()
      .subscribe((event) => controller.handleMutationCacheEvent(event));

    return () => {
      unsubscribeQueryCache();
      unsubscribeMutationCache();
    };
  }, [controller, queryClient]);

  useRozenitePluginAgentTool({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: getCacheSummaryTool,
    handler: () => controller.getCacheSummary(),
  });

  useRozenitePluginAgentTool({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: getOnlineStatusTool,
    handler: () => controller.getOnlineStatus(),
  });

  useRozenitePluginAgentTool<TanStackQueryAgentOnlineStatusInput>({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: setOnlineStatusTool,
    handler: (input: TanStackQueryAgentOnlineStatusInput) =>
      controller.setOnlineStatus(input),
  });

  useRozenitePluginAgentTool<TanStackQueryAgentPaginationInput>({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: listQueriesTool,
    handler: (input = {}) => controller.listQueries(input),
  });

  useRozenitePluginAgentTool<TanStackQueryAgentQueryHashInput>({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: getQueryDetailsTool,
    handler: (input: TanStackQueryAgentQueryHashInput) =>
      controller.getQueryDetails(input),
  });

  useRozenitePluginAgentTool<TanStackQueryAgentQueryHashInput>({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: refetchQueryTool,
    handler: (input: TanStackQueryAgentQueryHashInput) =>
      controller.refetchQuery(input),
  });

  useRozenitePluginAgentTool<TanStackQueryAgentQueryToggleInput>({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: setQueryLoadingTool,
    handler: (input: TanStackQueryAgentQueryToggleInput) =>
      controller.setQueryLoading(input),
  });

  useRozenitePluginAgentTool<TanStackQueryAgentQueryToggleInput>({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: setQueryErrorTool,
    handler: (input: TanStackQueryAgentQueryToggleInput) =>
      controller.setQueryError(input),
  });

  useRozenitePluginAgentTool<TanStackQueryAgentQueryHashInput>({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: invalidateQueryTool,
    handler: (input: TanStackQueryAgentQueryHashInput) =>
      controller.invalidateQuery(input),
  });

  useRozenitePluginAgentTool<TanStackQueryAgentQueryHashInput>({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: resetQueryTool,
    handler: (input: TanStackQueryAgentQueryHashInput) =>
      controller.resetQuery(input),
  });

  useRozenitePluginAgentTool<TanStackQueryAgentQueryHashInput>({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: removeQueryTool,
    handler: (input: TanStackQueryAgentQueryHashInput) =>
      controller.removeQuery(input),
  });

  useRozenitePluginAgentTool({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: clearQueryCacheTool,
    handler: () => controller.clearQueryCache(),
  });

  useRozenitePluginAgentTool<TanStackQueryAgentPaginationInput>({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: listMutationsTool,
    handler: (input = {}) => controller.listMutations(input),
  });

  useRozenitePluginAgentTool<TanStackQueryAgentMutationIdInput>({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: getMutationDetailsTool,
    handler: (input: TanStackQueryAgentMutationIdInput) =>
      controller.getMutationDetails(input),
  });

  useRozenitePluginAgentTool({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: clearMutationCacheTool,
    handler: () => controller.clearMutationCache(),
  });
};
