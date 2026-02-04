import { useEffect, useRef } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import type {
  MCPTool,
  RegisterToolMessage,
  UnregisterToolMessage,
  ToolCallMessage,
  ToolResultMessage,
} from './types.js';

const MCP_PLUGIN_ID = 'rozenite-mcp';

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

export function useRozeniteMCPTool<TInput = unknown, TOutput = unknown>(
  options: UseRozeniteMCPToolOptions<TInput, TOutput>
): void {
  const { tool, handler, enabled = true } = options;
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
      tools: [tool],
    });

    // Listen for tool calls
    const subscription = client.onMessage('tool-call', async (payload) => {
      console.log('Tool call', JSON.stringify(payload, null, 2));
      // Only handle calls for this tool
      if (payload.toolName !== tool.name) {
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
        toolNames: [tool.name],
      });
      subscription.remove();
    };
  }, [client, enabled, tool]);
}
