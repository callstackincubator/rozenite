import { Command } from 'commander';
import {
  DEFAULT_METRO_HOST,
  DEFAULT_METRO_PORT,
  STATIC_DOMAINS,
} from './constants.js';
import {
  inferToolShortName,
  buildRuntimePluginDomains,
  getDomainToolsByDefinition,
  resolveDomainToken,
} from './domain-utils.js';
import { printOutput } from './output.js';
import type { AgentTool, DomainDefinition, MetroTarget } from './types.js';
import {
  paginateRows,
  parseFields,
  parseLimit,
  projectRows,
} from './output-shaping.js';
import {
  callToolWithOptionalPagination,
  resolveAutoPaginationConfig,
} from './tool-pagination.js';
import { createAgentHttpClient } from './http-client.js';
import { getErrorMessage } from './error-message.js';

const REMOVED_ROZENITE_DOMAIN_HINT =
  'The `rozenite agent rozenite ...` path was removed. Use `rozenite agent <domain> ...`; run `rozenite agent domains -j`.';

const DOMAIN_ACTION_ALIASES = {
  'list-tools': 'list-tools',
  tools: 'list-tools',
  'get-tool-schema': 'get-tool-schema',
  schema: 'get-tool-schema',
  'call-tool': 'call-tool',
  call: 'call-tool',
} as const;

const DOMAIN_ACTION_HINT =
  'list-tools|tools, get-tool-schema|schema, call-tool|call';

type DomainAction = 'list-tools' | 'get-tool-schema' | 'call-tool';

type CommonOptions = {
  host: string;
  port: number;
  json?: boolean;
  pretty?: boolean;
  session?: string;
};

type ListDomainsOptions = CommonOptions & {
  fields?: string;
  limit?: string;
  cursor?: string;
  verbose?: boolean;
};

type DynamicDomainCommandOptions = CommonOptions & {
  tool?: string;
  args?: string;
  fields?: string;
  limit?: string;
  cursor?: string;
  pages?: string;
  maxItems?: string;
  verbose?: boolean;
  session?: string;
};

type SessionCommandOptions = CommonOptions & {
  deviceId?: string;
};

type ToolListRow = {
  name: string;
  shortName: string;
  description: string;
};

type DomainListRow = {
  id: string;
  kind: 'static' | 'plugin';
  pluginId?: string;
  slug?: string;
  description: string;
};

type AgentSessionOutput = {
  id: string;
  deviceId: string;
  deviceName: string;
  status: string;
};

const TOOL_LIST_FIELDS = ['name', 'shortName', 'description'] as const;
const TOOL_LIST_DEFAULT_FIELDS = ['name', 'shortName'] as const;
const DOMAIN_LIST_FIELDS = [
  'id',
  'kind',
  'pluginId',
  'slug',
  'description',
] as const;
const DOMAIN_LIST_DEFAULT_FIELDS = ['id', 'kind'] as const;

const projectSessionOutput = (
  session: Record<string, unknown>,
): AgentSessionOutput => ({
  id: String(session.id ?? ''),
  deviceId: String(session.deviceId ?? ''),
  deviceName: String(session.deviceName ?? ''),
  status: String(session.status ?? ''),
});

const getConnectionOptions = (cmd: Command): CommonOptions => {
  const options = cmd.optsWithGlobals<CommonOptions>();
  return {
    host: options.host ?? DEFAULT_METRO_HOST,
    port: Number(options.port ?? DEFAULT_METRO_PORT),
    pretty: options.pretty ?? false,
    session: options.session,
  };
};

const getSessionId = (cmd: Command): string => {
  const options = cmd.optsWithGlobals<CommonOptions>();
  if (!options.session) {
    throw new Error(
      'Missing required --session <id>. Create one with `rozenite agent session create`.',
    );
  }
  return options.session;
};

const getActionCommand = (args: unknown[]): Command => {
  const candidate = args[args.length - 1];
  if (!(candidate instanceof Command)) {
    throw new Error('Failed to resolve CLI command context');
  }

  return candidate;
};

const parseJsonArgs = (rawArgs?: string): unknown => {
  if (!rawArgs) {
    return {};
  }

  try {
    return JSON.parse(rawArgs);
  } catch {
    throw new Error('--args must be valid JSON');
  }
};

const resolveDomainTool = (
  domainTools: AgentTool[],
  domainLabel: string,
  toolName: string,
): AgentTool => {
  const exactMatch = domainTools.find((tool) => tool.name === toolName);
  const shortMatches = domainTools.filter(
    (tool) => inferToolShortName(tool.name) === toolName,
  );

  const selectedTool =
    exactMatch || (shortMatches.length === 1 ? shortMatches[0] : null);
  if (!selectedTool) {
    if (shortMatches.length > 1) {
      const fullNames = formatLimitedList(
        shortMatches.map((tool) => tool.name),
      );
      throw new Error(
        `Ambiguous tool "${toolName}" for domain "${domainLabel}". Matches: ${fullNames}.`,
      );
    }
    const available = formatLimitedList(domainTools.map((tool) => tool.name));
    throw new Error(
      `Tool "${toolName}" not found for domain "${domainLabel}". Available: ${available || 'none'}. Hint: rozenite agent ${domainLabel} tools`,
    );
  }

  return selectedTool;
};

const rankDomainSuggestions = (
  token: string,
  domains: DomainDefinition[],
): string[] => {
  const query = token.toLowerCase();

  return domains
    .map((domain) => {
      const candidates = [domain.id, domain.slug, domain.pluginId]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.toLowerCase());

      let score = 0;
      for (const candidate of candidates) {
        if (candidate === query) {
          score = Math.max(score, 100);
        } else if (candidate.startsWith(query)) {
          score = Math.max(score, 60);
        } else if (candidate.includes(query)) {
          score = Math.max(score, 40);
        }
      }

      return { domain, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.domain.id.localeCompare(b.domain.id))
    .slice(0, 5)
    .map((item) => item.domain.id);
};

const formatUnknownDomainError = (
  token: string,
  domains: DomainDefinition[],
): Error => {
  const suggestions = rankDomainSuggestions(token, domains);
  const suggestionsText =
    suggestions.length > 0 ? ` Did you mean: ${suggestions.join(', ')}?` : '';

  return new Error(
    `Unknown domain "${token}".${suggestionsText} Run \`rozenite agent domains\` to list available domains.`,
  );
};

const formatLimitedList = (items: string[]): string => {
  if (items.length <= 5) {
    return items.join(', ');
  }

  const first = items.slice(0, 5).join(', ');
  return `${first}, and ${items.length - 5} more`;
};

const outputAgentError = (command: Command, error: unknown): void => {
  const options = getConnectionOptions(command);
  printOutput(
    {
      error: {
        message: getErrorMessage(error),
      },
    },
    true,
    !!options.pretty,
  );
  process.exitCode = 1;
};

const runAgentAction = async (
  command: Command,
  action: () => Promise<void>,
): Promise<void> => {
  try {
    await action();
  } catch (error) {
    outputAgentError(command, error);
  }
};

const toDomainAction = (value: string): DomainAction | null => {
  const normalized = value.trim().toLowerCase();
  return (
    (DOMAIN_ACTION_ALIASES as Record<string, DomainAction>)[normalized] || null
  );
};

const registerDynamicPluginDomainDispatcher = (mcpCommand: Command): void => {
  mcpCommand
    .command('* [action] [rest...]')
    .description('Domain commands')
    .option('-t, --tool <name>', 'Tool name or short tool name')
    .option('-a, --args <json>', 'Tool arguments as JSON object', '{}')
    .option(
      '-f, --fields <csv>',
      `Fields to include (${TOOL_LIST_FIELDS.join(', ')})`,
    )
    .option('-v, --verbose', 'Include all supported fields')
    .option('-n, --limit <n>', 'Page size (default 20, max 100)')
    .option('-c, --cursor <token>', 'Opaque cursor from previous page')
    .option(
      '-p, --pages <n>',
      'Auto-follow paged tool responses for up to N pages',
    )
    .option(
      '-m, --max-items <n>',
      'Auto-pagination item cap (requires --pages)',
    )
    .requiredOption('-s, --session <id>', 'Target Agent session ID')
    .action(
      async (
        domainToken: string,
        actionToken?: string | string[],
        ...actionArgs: unknown[]
      ) => {
        const activeCommand = actionArgs[actionArgs.length - 1] as Command;
        await runAgentAction(activeCommand, async () => {
          const normalizedActionToken = Array.isArray(actionToken)
            ? actionToken[0]
            : actionToken;
          const actionTokenString = normalizedActionToken
            ? String(normalizedActionToken).trim()
            : '';
          if (domainToken === 'rozenite') {
            throw new Error(REMOVED_ROZENITE_DOMAIN_HINT);
          }

          if (!actionTokenString) {
            const actionInDomainPosition = toDomainAction(domainToken);
            if (actionInDomainPosition) {
              throw new Error(
                `Missing domain before action "${domainToken}". Use: rozenite agent <domain> ${domainToken}`,
              );
            }

            throw new Error(
              `Missing action for domain "${domainToken}". Expected: ${DOMAIN_ACTION_HINT}.`,
            );
          }

          const action = actionTokenString
            ? toDomainAction(actionTokenString)
            : null;
          if (!action) {
            throw new Error(
              `Unknown domain action "${actionTokenString}". Expected: ${DOMAIN_ACTION_HINT}.`,
            );
          }

          const dynamicOptions =
            activeCommand.optsWithGlobals<DynamicDomainCommandOptions>();
          const options = getConnectionOptions(activeCommand);
          const sessionId = getSessionId(activeCommand);
          const client = createAgentHttpClient({
            host: options.host,
            port: options.port,
          });

          const result = await (async () => {
            const tools = (await client.getSessionTools(sessionId)).tools;
            const runtimeDomains = buildRuntimePluginDomains(tools);
            const knownDomains = [...STATIC_DOMAINS, ...runtimeDomains];
            const resolvedDomain = resolveDomainToken(
              domainToken,
              knownDomains,
            );
            if (!resolvedDomain) {
              throw formatUnknownDomainError(domainToken, knownDomains);
            }
            const domainTools = getDomainToolsByDefinition(
              tools,
              resolvedDomain,
            );

            if (action === 'list-tools') {
              const fields = parseFields(
                dynamicOptions.fields,
                TOOL_LIST_FIELDS,
                TOOL_LIST_DEFAULT_FIELDS,
                !!dynamicOptions.verbose,
              );
              const limit = parseLimit(dynamicOptions.limit);
              const rows = domainTools
                .map<ToolListRow>((tool) => ({
                  name: tool.name,
                  shortName: inferToolShortName(tool.name),
                  description: tool.description,
                }))
                .sort((a, b) => a.name.localeCompare(b.name));
              const projected = projectRows(rows, fields);
              const paged = paginateRows(projected, {
                kind: 'tools',
                scope: `domain:${resolvedDomain.id}`,
                limit,
                cursor: dynamicOptions.cursor,
              });

              return {
                items: paged.items,
                page: paged.page,
              };
            }

            if (!dynamicOptions.tool) {
              throw new Error(
                '--tool is required for schema/get-tool-schema and call/call-tool',
              );
            }

            const selectedTool = resolveDomainTool(
              domainTools,
              resolvedDomain.id,
              dynamicOptions.tool,
            );

            if (action === 'get-tool-schema') {
              return {
                name: selectedTool.name,
                shortName: inferToolShortName(selectedTool.name),
                inputSchema: selectedTool.inputSchema,
              };
            }

            const parsedArgs = parseJsonArgs(dynamicOptions.args);
            const autoPagination = resolveAutoPaginationConfig(dynamicOptions);
            const payload = parsedArgs as Record<string, unknown>;
            const toolResult = await callToolWithOptionalPagination(
              {
                callTool: async (name: string, args: unknown) =>
                  (
                    await client.callSessionTool(sessionId, {
                      toolName: name,
                      args,
                    })
                  ).result,
              },
              selectedTool.name,
              payload,
              autoPagination,
            );

            return toolResult;
          })();

          printOutput(result, true, !!options.pretty);
        });
      },
    );
};

export const registerAgentCommand = (program: Command): void => {
  const mcpCommand = program
    .command('agent')
    .description(
      'CLI for session-scoped domain discovery and dynamic tool execution',
    )
    .option('--host <host>', 'Metro host', DEFAULT_METRO_HOST)
    .option('--port <port>', 'Metro port', String(DEFAULT_METRO_PORT))
    .option('-j, --json', 'Deprecated no-op; agent commands always output JSON')
    .option('--pretty', 'Pretty-print JSON output when --json is used');

  mcpCommand
    .command('targets')
    .description('List connected devices from Metro inspector')
    .action(async (...args: unknown[]) => {
      const command = getActionCommand(args);
      await runAgentAction(command, async () => {
        const options = getConnectionOptions(command);
        const targets = (await createAgentHttpClient(options).listTargets())
          .targets;
        const conciseTargets = targets.map((target: MetroTarget) => ({
          id: target.id,
          name: target.name,
        }));

        const payload = {
          items: conciseTargets,
        };

        printOutput(payload, true, !!options.pretty);
      });
    });

  const sessionCommand = mcpCommand
    .command('session')
    .description('Manage device-keyed Agent sessions')
    .option('--host <host>', 'Metro host', DEFAULT_METRO_HOST)
    .option('--port <port>', 'Metro port', String(DEFAULT_METRO_PORT))
    .option('-j, --json', 'Deprecated no-op; agent commands always output JSON')
    .option('--pretty', 'Pretty-print JSON output when --json is used');

  sessionCommand
    .command('create')
    .description('Create or reuse the Agent session for a device')
    .option('-d, --deviceId <id>', 'Target Metro device ID')
    .action(async (...args: unknown[]) => {
      const command = getActionCommand(args);
      await runAgentAction(command, async () => {
        const options = getConnectionOptions(command);
        const sessionOptions = command.optsWithGlobals<SessionCommandOptions>();
        const result = await createAgentHttpClient(options).createSession({
          deviceId: sessionOptions.deviceId,
        });
        printOutput(
          projectSessionOutput(result.session),
          true,
          !!options.pretty,
        );
      });
    });

  sessionCommand
    .command('list')
    .description('List running Agent sessions')
    .action(async (...args: unknown[]) => {
      const command = getActionCommand(args);
      await runAgentAction(command, async () => {
        const options = getConnectionOptions(command);
        const result = await createAgentHttpClient(options).listSessions();
        printOutput(
          result.sessions.map((session) => projectSessionOutput(session)),
          true,
          !!options.pretty,
        );
      });
    });

  sessionCommand
    .command('show')
    .description('Show one Agent session')
    .argument('<sessionId>', 'Session ID')
    .action(async (sessionId: string, ...args: unknown[]) => {
      const command = getActionCommand(args);
      await runAgentAction(command, async () => {
        const options = getConnectionOptions(command);
        const result =
          await createAgentHttpClient(options).getSession(sessionId);
        printOutput(
          projectSessionOutput(result.session),
          true,
          !!options.pretty,
        );
      });
    });

  sessionCommand
    .command('stop')
    .description('Stop one Agent session')
    .argument('<sessionId>', 'Session ID')
    .action(async (sessionId: string, ...args: unknown[]) => {
      const command = getActionCommand(args);
      await runAgentAction(command, async () => {
        const options = getConnectionOptions(command);
        const result =
          await createAgentHttpClient(options).stopSession(sessionId);
        printOutput(result, true, !!options.pretty);
      });
    });

  mcpCommand
    .command('list-domains')
    .alias('domains')
    .description('List available static and plugin domains')
    .option(
      '-f, --fields <csv>',
      `Fields to include (${DOMAIN_LIST_FIELDS.join(', ')})`,
    )
    .option('-v, --verbose', 'Include all supported fields')
    .option('-n, --limit <n>', 'Page size (default 20, max 100)')
    .option('-c, --cursor <token>', 'Opaque cursor from previous page')
    .requiredOption('-s, --session <id>', 'Target Agent session ID')
    .action(async (_args: ListDomainsOptions, command: Command) => {
      await runAgentAction(command, async () => {
        const options = getConnectionOptions(command);
        const listOptions = command.optsWithGlobals<ListDomainsOptions>();
        const fields = parseFields(
          listOptions.fields,
          DOMAIN_LIST_FIELDS,
          DOMAIN_LIST_DEFAULT_FIELDS,
          !!listOptions.verbose,
        );
        const limit = parseLimit(listOptions.limit);
        const sessionId = getSessionId(command);
        const client = createAgentHttpClient(options);

        const result = await (async () => {
          const tools = (await client.getSessionTools(sessionId)).tools;
          const runtimeDomains = buildRuntimePluginDomains(tools);
          const domains = [...STATIC_DOMAINS, ...runtimeDomains]
            .map<DomainListRow>((domain) => ({
              id: domain.id,
              kind: domain.kind,
              pluginId: domain.pluginId,
              slug: domain.slug,
              description: domain.description,
            }))
            .sort((a, b) => a.id.localeCompare(b.id));
          const projected = projectRows(domains, fields);
          const paged = paginateRows(projected, {
            kind: 'domains',
            scope: 'all',
            limit,
            cursor: listOptions.cursor,
          });

          return {
            items: paged.items,
            page: paged.page,
          };
        })();

        printOutput(result, true, !!options.pretty);
      });
    });

  registerDynamicPluginDomainDispatcher(mcpCommand);
};
