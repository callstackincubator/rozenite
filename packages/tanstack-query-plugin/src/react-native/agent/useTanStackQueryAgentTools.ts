import { useEffect, useMemo } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { useRozenitePluginAgentTool } from '@rozenite/agent-bridge';
import {
  createTanStackQueryAgentController,
} from './tanstack-query-agent';
import {
  TANSTACK_QUERY_AGENT_PLUGIN_ID,
  tanstackQueryToolDefinitions,
} from '../../shared/agent-tools';

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
    tool: tanstackQueryToolDefinitions.getCacheSummary,
    handler: () => controller.getCacheSummary(),
  });

  useRozenitePluginAgentTool({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: tanstackQueryToolDefinitions.getOnlineStatus,
    handler: () => controller.getOnlineStatus(),
  });

  useRozenitePluginAgentTool({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: tanstackQueryToolDefinitions.setOnlineStatus,
    handler: (input) => controller.setOnlineStatus(input),
  });

  useRozenitePluginAgentTool({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: tanstackQueryToolDefinitions.listQueries,
    handler: (input = {}) => controller.listQueries(input),
  });

  useRozenitePluginAgentTool({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: tanstackQueryToolDefinitions.getQueryDetails,
    handler: (input) => controller.getQueryDetails(input),
  });

  useRozenitePluginAgentTool({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: tanstackQueryToolDefinitions.refetchQuery,
    handler: (input) => controller.refetchQuery(input),
  });

  useRozenitePluginAgentTool({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: tanstackQueryToolDefinitions.setQueryLoading,
    handler: (input) => controller.setQueryLoading(input),
  });

  useRozenitePluginAgentTool({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: tanstackQueryToolDefinitions.setQueryError,
    handler: (input) => controller.setQueryError(input),
  });

  useRozenitePluginAgentTool({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: tanstackQueryToolDefinitions.invalidateQuery,
    handler: (input) => controller.invalidateQuery(input),
  });

  useRozenitePluginAgentTool({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: tanstackQueryToolDefinitions.resetQuery,
    handler: (input) => controller.resetQuery(input),
  });

  useRozenitePluginAgentTool({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: tanstackQueryToolDefinitions.removeQuery,
    handler: (input) => controller.removeQuery(input),
  });

  useRozenitePluginAgentTool({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: tanstackQueryToolDefinitions.clearQueryCache,
    handler: () => controller.clearQueryCache(),
  });

  useRozenitePluginAgentTool({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: tanstackQueryToolDefinitions.listMutations,
    handler: (input = {}) => controller.listMutations(input),
  });

  useRozenitePluginAgentTool({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: tanstackQueryToolDefinitions.getMutationDetails,
    handler: (input) => controller.getMutationDetails(input),
  });

  useRozenitePluginAgentTool({
    pluginId: TANSTACK_QUERY_AGENT_PLUGIN_ID,
    tool: tanstackQueryToolDefinitions.clearMutationCache,
    handler: () => controller.clearMutationCache(),
  });
};
