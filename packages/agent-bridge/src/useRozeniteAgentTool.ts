import { useEffect, useRef } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import {
  AGENT_PLUGIN_ID,
  type AgentTool,
  type RegisterToolMessage,
  type UnregisterToolMessage,
  type ToolCallMessage,
  type ToolResultMessage,
} from './types.js';

type AgentEventMap = {
  'register-tool': RegisterToolMessage['payload'];
  'unregister-tool': UnregisterToolMessage['payload'];
  'tool-call': ToolCallMessage['payload'];
  'tool-result': ToolResultMessage['payload'];
};

export interface UseRozeniteAgentToolOptions<TInput = unknown, TOutput = unknown> {
  tool: AgentTool;
  handler: (args: TInput) => Promise<TOutput> | TOutput;
  enabled?: boolean;
}

export interface UseRozenitePluginAgentToolOptions<TInput = unknown, TOutput = unknown>
  extends UseRozeniteAgentToolOptions<TInput, TOutput> {
  pluginId: string;
}

export interface UseRozeniteInAppAgentToolOptions<TInput = unknown, TOutput = unknown>
  extends UseRozeniteAgentToolOptions<TInput, TOutput> {
  domain?: string;
}

const getQualifiedToolName = (domain: string, toolName: string): string => {
  return `${domain.trim()}.${toolName.trim()}`;
};

function useRozeniteDomainAgentTool<TInput = unknown, TOutput = unknown>(
  domain: string,
  options: UseRozeniteAgentToolOptions<TInput, TOutput>
): void {
  const { tool, handler, enabled = true } = options;
  const toolName = getQualifiedToolName(domain, tool.name);
  const qualifiedTool = {
    ...tool,
    name: toolName,
  } satisfies AgentTool;
  const client = useRozeniteDevToolsClient<AgentEventMap>({
    pluginId: AGENT_PLUGIN_ID,
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

export function useRozenitePluginAgentTool<TInput = unknown, TOutput = unknown>(
  options: UseRozenitePluginAgentToolOptions<TInput, TOutput>
): void {
  const { pluginId, ...toolOptions } = options;
  useRozeniteDomainAgentTool(pluginId, toolOptions);
}

export function useRozeniteInAppAgentTool<TInput = unknown, TOutput = unknown>(
  options: UseRozeniteInAppAgentToolOptions<TInput, TOutput>
): void {
  const { domain = 'app', ...toolOptions } = options;
  useRozeniteDomainAgentTool(domain, toolOptions);
}
