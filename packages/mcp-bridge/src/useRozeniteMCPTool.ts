import { useEffect, useRef } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import {
  MCP_PLUGIN_ID,
  type MCPTool,
  type RegisterToolMessage,
  type UnregisterToolMessage,
  type ToolCallMessage,
  type ToolResultMessage,
} from './types.js';

type MCPEventMap = {
  'register-tool': RegisterToolMessage['payload'];
  'unregister-tool': UnregisterToolMessage['payload'];
  'tool-call': ToolCallMessage['payload'];
  'tool-result': ToolResultMessage['payload'];
};

export interface UseRozeniteMCPToolOptions<TInput = unknown, TOutput = unknown> {
  tool: MCPTool;
  handler: (args: TInput) => Promise<TOutput> | TOutput;
  enabled?: boolean;
}

export interface UseRozenitePluginMCPToolOptions<TInput = unknown, TOutput = unknown>
  extends UseRozeniteMCPToolOptions<TInput, TOutput> {
  pluginId: string;
}

export interface UseRozeniteInAppMCPToolOptions<TInput = unknown, TOutput = unknown>
  extends UseRozeniteMCPToolOptions<TInput, TOutput> {
  domain?: string;
}

const getQualifiedToolName = (domain: string, toolName: string): string => {
  return `${domain.trim()}.${toolName.trim()}`;
};

function useRozeniteDomainMCPTool<TInput = unknown, TOutput = unknown>(
  domain: string,
  options: UseRozeniteMCPToolOptions<TInput, TOutput>
): void {
  const { tool, handler, enabled = true } = options;
  const toolName = getQualifiedToolName(domain, tool.name);
  const qualifiedTool = {
    ...tool,
    name: toolName,
  } satisfies MCPTool;
  const client = useRozeniteDevToolsClient<MCPEventMap>({
    pluginId: MCP_PLUGIN_ID,
  });

  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!client || !enabled) {
      return;
    }

    // Register the tool
    client.send('register-tool', {
      tools: [qualifiedTool],
    });

    // Listen for tool calls
    const subscription = client.onMessage('tool-call', async (payload) => {
      console.log('Tool call', JSON.stringify(payload, null, 2));
      // Only handle calls for this tool
      if (payload.toolName !== toolName) {
        return;
      }

      try {
        const result = await handlerRef.current(payload.arguments as TInput);

        const response: ToolResultMessage['payload'] = {
          callId: payload.callId,
          success: true,
          result,
        };

        client.send('tool-result', response);
      } catch (error) {
        const response: ToolResultMessage['payload'] = {
          callId: payload.callId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };

        client.send('tool-result', response);
      }
    });

    return () => {
      // Unregister the tool on unmount
      client.send('unregister-tool', {
        toolNames: [toolName],
      });
      subscription.remove();
    };
  }, [client, enabled, tool, toolName]);
}

export function useRozenitePluginMCPTool<TInput = unknown, TOutput = unknown>(
  options: UseRozenitePluginMCPToolOptions<TInput, TOutput>
): void {
  const { pluginId, ...toolOptions } = options;
  useRozeniteDomainMCPTool(pluginId, toolOptions);
}

export function useRozeniteInAppMCPTool<TInput = unknown, TOutput = unknown>(
  options: UseRozeniteInAppMCPToolOptions<TInput, TOutput>
): void {
  const { domain = 'app', ...toolOptions } = options;
  useRozeniteDomainMCPTool(domain, toolOptions);
}
