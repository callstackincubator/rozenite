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

type MaybePromise<T> = Promise<T> | T;

type AgentEventMap = {
  'agent-session-ready': AgentSessionReadyMessage['payload'];
  'register-tool': RegisterToolMessage['payload'];
  'unregister-tool': UnregisterToolMessage['payload'];
  'tool-call': ToolCallMessage['payload'];
  'tool-result': ToolResultMessage['payload'];
};

interface UseRozeniteAgentToolRuntimeOptions {
  tool: AgentTool;
  handler: (args: unknown) => MaybePromise<unknown>;
  enabled?: boolean;
}

export interface UseRozeniteTypedAgentToolOptions<
  TTool extends AgentTool = AgentTool,
> {
  tool: TTool;
  handler: (
    args: InferAgentToolArgs<TTool>,
  ) => MaybePromise<InferAgentToolResult<TTool>>;
  enabled?: boolean;
}

export interface UseRozenitePlainAgentToolOptions<
  TArgs = unknown,
  TResult = unknown,
> {
  tool: AgentTool;
  handler: (args: TArgs) => MaybePromise<TResult>;
  enabled?: boolean;
}

export type UseRozeniteAgentToolOptions<
  TToolOrArgs = AgentTool,
  TResult = unknown,
> = TToolOrArgs extends AgentTool
  ? UseRozeniteTypedAgentToolOptions<TToolOrArgs>
  : UseRozenitePlainAgentToolOptions<TToolOrArgs, TResult>;

type UseRozenitePluginAgentToolRuntimeOptions = {
  pluginId: string;
} & UseRozeniteAgentToolRuntimeOptions;

export type UseRozeniteTypedPluginAgentToolWithPluginIdOptions<
  TTool extends AgentTool = AgentTool,
> = {
  pluginId: string;
} & UseRozeniteTypedAgentToolOptions<TTool>;

export type UseRozenitePlainPluginAgentToolOptions<
  TArgs = unknown,
  TResult = unknown,
> = {
  pluginId: string;
} & UseRozenitePlainAgentToolOptions<TArgs, TResult>;

export type UseRozenitePluginAgentToolOptions<
  TToolOrArgs = AgentTool,
  TResult = unknown,
> = TToolOrArgs extends AgentTool
  ? UseRozeniteTypedPluginAgentToolWithPluginIdOptions<TToolOrArgs>
  : UseRozenitePlainPluginAgentToolOptions<TToolOrArgs, TResult>;

export type UseRozeniteInAppAgentToolOptions<
  TToolOrArgs = AgentTool,
  TResult = unknown,
> = UseRozeniteAgentToolOptions<TToolOrArgs, TResult>;

const APP_DOMAIN = 'app';

const getQualifiedToolName = (domain: string, toolName: string): string => {
  return `${domain.trim()}.${toolName.trim()}`;
};

function useRozeniteDomainAgentTool(
  domain: string,
  options: UseRozeniteAgentToolRuntimeOptions,
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
          const result = await handlerRef.current(payload.arguments);

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
 * from the tool definition. Plain `AgentTool` objects can either fall back to
 * `unknown` or provide explicit handler generics, e.g. `useRozenitePluginAgentTool<MyArgs>`.
 *
 * @param options - Configuration using `pluginId`, `tool`, `handler`, and optional `enabled`.
 */
export function useRozenitePluginAgentTool<
  TToolOrArgs = AgentTool,
  TResult = unknown,
>(
  options: UseRozenitePluginAgentToolOptions<TToolOrArgs, TResult>,
): void {
  const { pluginId, ...toolOptions } =
    options as UseRozenitePluginAgentToolRuntimeOptions;
  useRozeniteDomainAgentTool(pluginId, toolOptions);
}

/**
 * Registers an agent tool under the `app` domain so external agents (e.g. CLI, Cursor)
 * can invoke it via the Rozenite devtools bridge.
 *
 * The tool is qualified as `app.{tool.name}`. It is registered when the component
 * mounts (and `enabled` is true) and unregistered on unmount.
 *
 * When `tool` is a typed contract object, handler input/output types are inferred
 * from the tool definition. Plain `AgentTool` objects can either fall back to
 * `unknown` or provide explicit handler generics, e.g. `useRozeniteInAppAgentTool<MyArgs>`.
 *
 * @param options - Configuration: `tool`, `handler`, and optional `enabled`.
 */
export function useRozeniteInAppAgentTool<
  TToolOrArgs = AgentTool,
  TResult = unknown,
>(
  options: UseRozeniteInAppAgentToolOptions<TToolOrArgs, TResult>,
): void {
  const { ...toolOptions } = options;
  useRozeniteDomainAgentTool(
    APP_DOMAIN,
    toolOptions as UseRozeniteAgentToolRuntimeOptions,
  );
}
