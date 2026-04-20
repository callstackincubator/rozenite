import type {
  AgentSessionInfo,
  AgentTool,
  AgentToolDescriptor,
} from '@rozenite/agent-shared';
import { STATIC_DOMAINS } from './constants.js';
import {
  buildRuntimePluginDomains,
  formatUnknownDomainError,
  getDomainToolsByDefinition,
  resolveDomainToken,
  resolveDomainTool,
  toAgentDomainTool,
  toAgentToolSchema,
} from './domain-utils.js';
import { callToolWithOptionalPagination } from './pagination.js';
import { createAgentTransport } from './transport.js';
import type {
  AgentCallToolAutoPaginationOptions,
  AgentClient,
  AgentClientOptions,
  AgentDynamicToolCallInput,
  AgentSessionCallback,
  AgentSessionClient,
  AgentSessionTools,
  AgentToolCallOptions,
  DomainDefinition,
} from './types.js';

const getKnownDomains = (tools: AgentTool[]): DomainDefinition[] => {
  const runtimeDomains = buildRuntimePluginDomains(tools);
  return [...STATIC_DOMAINS, ...runtimeDomains].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
};

const sortTools = <
  TTool extends {
    name: string;
  },
>(
  tools: TTool[],
): TTool[] => {
  return [...tools].sort((a, b) => a.name.localeCompare(b.name));
};

const toAutoPaginationConfig = (
  options?: AgentCallToolAutoPaginationOptions,
): AgentCallToolAutoPaginationOptions => {
  if (!options) {
    return {};
  }

  return options;
};

export const createAgentClient = (
  options?: AgentClientOptions,
): AgentClient => {
  const transport = createAgentTransport(options);

  const resolveDomainContext = async (input: {
    sessionId: string;
    domain: string;
  }) => {
    const { tools } = await transport.getSessionTools(input.sessionId);
    const sortedTools = sortTools(tools);
    const knownDomains = getKnownDomains(sortedTools);
    const resolvedDomain = resolveDomainToken(input.domain, knownDomains);
    if (!resolvedDomain) {
      throw formatUnknownDomainError(input.domain, knownDomains);
    }

    const domainTools = sortTools(
      getDomainToolsByDefinition(sortedTools, resolvedDomain),
    );

    return {
      knownDomains,
      resolvedDomain,
      domainTools,
    };
  };

  const callSessionTool = async <TArgs = unknown, TResult = unknown>(
    input: {
      sessionId: string;
    } & AgentDynamicToolCallInput<TArgs>,
  ): Promise<TResult> => {
    const { sessionId, domain, tool, args = {} as TArgs, autoPaginate } = input;
    const { resolvedDomain, domainTools } = await resolveDomainContext({
      sessionId,
      domain,
    });
    const domainLabel = resolvedDomain.pluginId ?? resolvedDomain.id;
    const selectedTool = resolveDomainTool(domainTools, domainLabel, tool);

    return (await callToolWithOptionalPagination(
      {
        callTool: async (name, payload) =>
          (
            await transport.callSessionTool(sessionId, {
              toolName: name,
              args: payload,
            })
          ).result,
      },
      selectedTool.name,
      args,
      toAutoPaginationConfig(autoPaginate),
    )) as TResult;
  };

  const createSessionClient = (sessionInfo: AgentSessionInfo): AgentSessionClient => {
    let stopped = sessionInfo.status === 'stopped';

    const listDomains = async () => {
      const { tools } = await transport.getSessionTools(sessionInfo.id);
      return getKnownDomains(sortTools(tools));
    };

    const toolsApi: AgentSessionTools = {
      list: async ({ domain }) => {
        const { domainTools } = await resolveDomainContext({
          sessionId: sessionInfo.id,
          domain,
        });
        return domainTools.map(toAgentDomainTool);
      },
      getSchema: async ({ domain, tool }) => {
        const { resolvedDomain, domainTools } = await resolveDomainContext({
          sessionId: sessionInfo.id,
          domain,
        });
        const domainLabel = resolvedDomain.pluginId ?? resolvedDomain.id;
        const selectedTool = resolveDomainTool(domainTools, domainLabel, tool);
        return toAgentToolSchema(selectedTool);
      },
      call: (async (
        descriptorOrInput:
          | AgentToolDescriptor<unknown, unknown>
          | AgentDynamicToolCallInput<unknown>,
        argsOrOptions?: unknown,
        maybeOptions?: AgentToolCallOptions,
      ) => {
        if (
          typeof descriptorOrInput === 'object' &&
          descriptorOrInput !== null &&
          'tool' in descriptorOrInput
        ) {
          return await callSessionTool({
            sessionId: sessionInfo.id,
            ...descriptorOrInput,
          });
        }

        const descriptor = descriptorOrInput as AgentToolDescriptor<
          unknown,
          unknown
        >;
        return await callSessionTool({
          sessionId: sessionInfo.id,
          domain: descriptor.domain,
          tool: descriptor.name,
          args: argsOrOptions,
          autoPaginate: maybeOptions?.autoPaginate,
        });
      }) as AgentSessionTools['call'],
    };

    const session: AgentSessionClient = {
      id: sessionInfo.id,
      info: sessionInfo,
      stop: async () => {
        if (stopped) {
          return { stopped: true };
        }

        const result = await transport.stopSession(sessionInfo.id);
        stopped = true;
        session.info = {
          ...session.info,
          status: 'stopped',
        };
        return result;
      },
      domains: {
        list: listDomains,
      },
      tools: toolsApi,
    };

    return session;
  };

  const targets = {
    list: async () => {
      return (await transport.listTargets()).targets;
    },
  };

  const openSession: AgentClient['openSession'] = async (input = {}) => {
    const session = (await transport.createSession(input)).session;
    return createSessionClient(session);
  };

  const attachSession: AgentClient['attachSession'] = async (sessionId) => {
    const session = (await transport.getSession(sessionId)).session;
    return createSessionClient(session);
  };

  const withSession: AgentClient['withSession'] = async <T>(
    inputOrCallback:
      | Parameters<AgentClient['openSession']>[0]
      | AgentSessionCallback<T>,
    maybeCallback?: AgentSessionCallback<T>,
  ): Promise<T> => {
    const callback =
      typeof inputOrCallback === 'function' ? inputOrCallback : maybeCallback;
    const input = typeof inputOrCallback === 'function' ? {} : inputOrCallback;

    if (typeof callback !== 'function') {
      throw new Error('withSession requires a callback.');
    }

    const session = await openSession(input);

    try {
      return await callback(session);
    } finally {
      await session.stop();
    }
  };

  return {
    targets,
    withSession,
    openSession,
    attachSession,
  };
};
