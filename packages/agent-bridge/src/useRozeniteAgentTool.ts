import { useEffect, useRef } from 'react';
import type {
  InferAgentToolArgs,
  InferAgentToolResult,
} from '@rozenite/agent-shared';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import {
  AGENT_PLUGIN_ID,
  type AgentTool,
  type AgentSessionReadyMessage,
  type RegisterToolMessage,
  type UnregisterToolMessage,
  type ToolCallMessage,
  type ToolResultMessage,
} from './types.js';

type AgentEventMap = {
  'agent-session-ready': AgentSessionReadyMessage['payload'];
  'register-tool': RegisterToolMessage['payload'];
  'unregister-tool': UnregisterToolMessage['payload'];
  'tool-call': ToolCallMessage['payload'];
  'tool-result': ToolResultMessage['payload'];
};

export interface UseRozeniteAgentToolOptions<
  TTool extends AgentTool = AgentTool,
> {
  tool: TTool;
  handler: (
    args: InferAgentToolArgs<TTool>,
  ) => Promise<InferAgentToolResult<TTool>> | InferAgentToolResult<TTool>;
  enabled?: boolean;
}

export type UseRozenitePluginAgentToolWithPluginIdOptions<
  TTool extends AgentTool = AgentTool,
> = {
  pluginId: string;
} & UseRozeniteAgentToolOptions<TTool>;

export type UseRozenitePluginAgentToolOptions<
  TTool extends AgentTool = AgentTool,
> = UseRozenitePluginAgentToolWithPluginIdOptions<TTool>;

export type UseRozeniteInAppAgentToolOptions<
  TTool extends AgentTool = AgentTool,
> = UseRozeniteAgentToolOptions<TTool>;

const APP_DOMAIN = 'app';

const getQualifiedToolName = (domain: string, toolName: string): string => {
  return `${domain.trim()}.${toolName.trim()}`;
};

function useRozeniteDomainAgentTool<TTool extends AgentTool = AgentTool>(
  domain: string,
  options: UseRozeniteAgentToolOptions<TTool>,
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
    if (!client) {
      return;
    }

    const registerTool = (): void => {
      if (!enabled) {
        return;
      }

      client.send('register-tool', {
        tools: [qualifiedTool],
      });
    };

    const toolCallSubscription = client.onMessage(
      'tool-call',
      async (payload) => {
        if (payload.toolName !== toolName) {
          return;
        }

        try {
          const result = await handlerRef.current(
            payload.arguments as InferAgentToolArgs<TTool>,
          );

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
      },
    );

    const sessionReadySubscription = client.onMessage(
      'agent-session-ready',
      () => {
        registerTool();
      },
    );

    registerTool();

    return () => {
      if (enabled) {
        client.send('unregister-tool', {
          toolNames: [toolName],
        });
      }
      sessionReadySubscription.remove();
      toolCallSubscription.remove();
    };
  }, [client, enabled, tool, toolName]);
}

/**
 * Registers an agent tool under a plugin domain so external agents (e.g. CLI, Cursor)
 * can invoke it via the Rozenite devtools bridge.
 *
 * The tool is qualified as `{pluginId}.{tool.name}`. It is registered when the
 * component mounts (and `enabled` is true) and unregistered on unmount.
 *
 * When `tool` is a typed contract object, handler input/output types are inferred
 * from the tool definition. Plain `AgentTool` objects continue to work and fall
 * back to `unknown`.
 *
 * @param options - Configuration using `pluginId`, `tool`, `handler`, and optional `enabled`.
 */
export function useRozenitePluginAgentTool<TTool extends AgentTool = AgentTool>(
  options: UseRozenitePluginAgentToolOptions<TTool>,
): void {
  const { pluginId, ...toolOptions } = options;
  useRozeniteDomainAgentTool(pluginId, toolOptions);
}

/**
 * Registers an agent tool under the `app` domain so external agents (e.g. CLI, Cursor)
 * can invoke it via the Rozenite devtools bridge.
 *
 * The tool is qualified as `app.{tool.name}`. It is registered when the component
 * mounts (and `enabled` is true) and unregistered on unmount.
 *
 * @param options - Configuration: `tool` (AgentTool), `handler`, and optional `enabled`.
 */
export function useRozeniteInAppAgentTool<TTool extends AgentTool = AgentTool>(
  options: UseRozeniteInAppAgentToolOptions<TTool>,
): void {
  const { ...toolOptions } = options;
  useRozeniteDomainAgentTool(APP_DOMAIN, toolOptions);
}
