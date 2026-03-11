import { Command } from 'commander';
import { DEFAULT_METRO_HOST, DEFAULT_METRO_PORT, STATIC_DOMAINS } from './constants.js';
import {
  inferToolShortName,
  buildRuntimePluginDomains,
  getDomainToolsByDefinition,
  resolveDomainToken,
} from './domain-utils.js';
import { printOutput } from './output.js';
import type { AgentTool, DomainDefinition } from './types.js';
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
import { callDaemon, callRunningDaemon } from './daemon-client.js';

const REMOVED_ROZENITE_DOMAIN_HINT =
  'The `rozenite agent rozenite ...` path was removed. Use `rozenite agent <domain> ...`; run `rozenite agent domains -j`.';
const PLUGIN_DOMAIN_GUIDE_MAX_TOOLS = 20;

const DOMAIN_ACTION_ALIASES = {
  'list-tools': 'list-tools',
  tools: 'list-tools',
  'get-tool-schema': 'get-tool-schema',
  schema: 'get-tool-schema',
  'call-tool': 'call-tool',
  call: 'call-tool',
} as const;

const DOMAIN_ACTION_HINT = 'list-tools|tools, get-tool-schema|schema, call-tool|call';

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

const TOOL_LIST_FIELDS = ['name', 'shortName', 'description'] as const;
const TOOL_LIST_DEFAULT_FIELDS = ['name', 'shortName'] as const;
const DOMAIN_LIST_FIELDS = ['id', 'kind', 'pluginId', 'slug', 'description'] as const;
const DOMAIN_LIST_DEFAULT_FIELDS = ['id', 'kind', 'pluginId', 'slug'] as const;

const getConnectionOptions = (cmd: Command): CommonOptions => {
  const options = cmd.optsWithGlobals<CommonOptions>();
  return {
    host: options.host ?? DEFAULT_METRO_HOST,
    port: Number(options.port ?? DEFAULT_METRO_PORT),
    json: options.json ?? false,
    pretty: options.pretty ?? false,
    session: options.session,
  };
};

const getSessionId = (cmd: Command): string => {
  const options = cmd.optsWithGlobals<CommonOptions>();
  if (!options.session) {
    throw new Error('Missing required --session <id>. Create one with `rozenite agent session create -j`.');
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

  const selectedTool = exactMatch || (shortMatches.length === 1 ? shortMatches[0] : null);
  if (!selectedTool) {
    if (shortMatches.length > 1) {
      const fullNames = formatLimitedList(shortMatches.map((tool) => tool.name));
      throw new Error(
        `Ambiguous tool "${toolName}" for domain "${domainLabel}". Matches: ${fullNames}.`,
      );
    }
    const available = formatLimitedList(domainTools.map((tool) => tool.name));
    throw new Error(
      `Tool "${toolName}" not found for domain "${domainLabel}". Available: ${available || 'none'}. Hint: rozenite agent ${domainLabel} tools -j`,
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
  const suggestionsText = suggestions.length > 0
    ? ` Did you mean: ${suggestions.join(', ')}?`
    : '';

  return new Error(
    `Unknown domain "${token}".${suggestionsText} Run \`rozenite agent domains -j\` to list available domains.`,
  );
};

const formatLimitedList = (items: string[]): string => {
  if (items.length <= 5) {
    return items.join(', ');
  }

  const first = items.slice(0, 5).join(', ');
  return `${first}, and ${items.length - 5} more`;
};

const toDomainAction = (value: string): DomainAction | null => {
  const normalized = value.trim().toLowerCase();
  return (DOMAIN_ACTION_ALIASES as Record<string, DomainAction>)[normalized] || null;
};

const resolveDomainContext = async (
  workspace: string,
  sessionId: string,
  domainToken: string,
): Promise<{ resolvedDomain: DomainDefinition; domainTools: AgentTool[] }> => {
  const tools = (await callDaemon(workspace, 'session.tools', { sessionId })).tools;
  const runtimeDomains = buildRuntimePluginDomains(tools);
  const knownDomains = [...STATIC_DOMAINS, ...runtimeDomains];
  const resolvedDomain = resolveDomainToken(domainToken, knownDomains);

  if (!resolvedDomain) {
    throw formatUnknownDomainError(domainToken, knownDomains);
  }

  return {
    resolvedDomain,
    domainTools: getDomainToolsByDefinition(tools, resolvedDomain),
  };
};

const generateDomainGuide = (
  domain: DomainDefinition,
  domainTools: AgentTool[],
): string => {
  const visibleTools = domainTools.slice(0, PLUGIN_DOMAIN_GUIDE_MAX_TOOLS);
  const truncated = domainTools.length > visibleTools.length;

  const lines: string[] = [
    `# Domain: ${domain.id}`,
    '',
    domain.kind === 'plugin'
      ? 'Runtime plugin tools discovered from the connected device.'
      : 'Built-in Agent tools discovered from the connected device.',
    '',
    '## Metadata',
    `- Token: \`${domain.id}\``,
    `- Kind: \`${domain.kind}\``,
    ...(domain.pluginId ? [`- Plugin ID: \`${domain.pluginId}\``] : []),
    '',
    '## Commands',
    `- \`rozenite agent ${domain.id} tools -n 20 -j --session <id>\``,
    `- \`rozenite agent ${domain.id} schema -t <name> -j --session <id>\``,
    `- \`rozenite agent ${domain.id} call -t <name> -a '<json>' -j --session <id> [-p <n>] [-m <n>]\``,
    '',
    '## Tools',
  ];

  if (visibleTools.length === 0) {
    lines.push('- No tools are currently available for this domain.');
  } else {
    for (const tool of visibleTools) {
      lines.push(`- \`${tool.name}\` (short: \`${inferToolShortName(tool.name)}\`)`);
    }
  }

  if (truncated) {
    lines.push(`- Truncated to ${PLUGIN_DOMAIN_GUIDE_MAX_TOOLS} of ${domainTools.length} tools.`);
  }

  return lines.join('\n');
};

const registerDynamicPluginDomainDispatcher = (mcpCommand: Command): void => {
  mcpCommand
    .command('* [action] [rest...]')
    .description('Domain commands')
    .option('-t, --tool <name>', 'Tool name or short tool name')
    .option('-a, --args <json>', 'Tool arguments as JSON object', '{}')
    .option('-f, --fields <csv>', `Fields to include (${TOOL_LIST_FIELDS.join(', ')})`)
    .option('-v, --verbose', 'Include all supported fields')
    .option('-n, --limit <n>', 'Page size (default 20, max 100)')
    .option('-c, --cursor <token>', 'Opaque cursor from previous page')
    .option('-p, --pages <n>', 'Auto-follow paged tool responses for up to N pages')
    .option('-m, --max-items <n>', 'Auto-pagination item cap (requires --pages)')
    .option('-j, --json', 'Output JSON')
    .requiredOption('-s, --session <id>', 'Target Agent session ID')
    .action(async (
      domainToken: string,
      actionToken?: string | string[],
      ...actionArgs: unknown[]
    ) => {
      const activeCommand = actionArgs[actionArgs.length - 1] as Command;
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
            `Missing domain before action "${domainToken}". Use: rozenite agent <domain> ${domainToken} -j`,
          );
        }

        throw new Error(
          `Missing action for domain "${domainToken}". Expected: ${DOMAIN_ACTION_HINT}.`,
        );
      }

      const action = actionTokenString ? toDomainAction(actionTokenString) : null;
      if (!action) {
        throw new Error(
          `Unknown domain action "${actionTokenString}". Expected: ${DOMAIN_ACTION_HINT}.`,
        );
      }

      const dynamicOptions = activeCommand.optsWithGlobals<DynamicDomainCommandOptions>();
      const options = getConnectionOptions(activeCommand);
      const sessionId = getSessionId(activeCommand);
      const workspace = process.cwd();

      const result = await (async () => {
        const { resolvedDomain, domainTools } = await resolveDomainContext(
          workspace,
          sessionId,
          domainToken,
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
            domain: resolvedDomain.id,
            sessionId,
            ...(resolvedDomain.pluginId ? { pluginId: resolvedDomain.pluginId } : {}),
            items: paged.items,
            page: paged.page,
          };
        }

        if (!dynamicOptions.tool) {
          throw new Error('--tool is required for schema/get-tool-schema and call/call-tool');
        }

        const selectedTool = resolveDomainTool(domainTools, resolvedDomain.id, dynamicOptions.tool);

        if (action === 'get-tool-schema') {
          return {
            domain: resolvedDomain.id,
            sessionId,
            ...(resolvedDomain.pluginId ? { pluginId: resolvedDomain.pluginId } : {}),
            tool: {
              name: selectedTool.name,
              shortName: inferToolShortName(selectedTool.name),
              description: selectedTool.description,
              inputSchema: selectedTool.inputSchema,
            },
          };
        }

        const parsedArgs = parseJsonArgs(dynamicOptions.args);
        const autoPagination = resolveAutoPaginationConfig(dynamicOptions);
        const payload = parsedArgs as Record<string, unknown>;
        const toolResult = await callToolWithOptionalPagination(
          {
            callTool: async (name: string, args: unknown) =>
              (await callDaemon(workspace, 'session.call-tool', {
                sessionId,
                toolName: name,
                args,
              })).result,
          },
          selectedTool.name,
          payload,
          autoPagination,
        );

        return {
          domain: resolvedDomain.id,
          sessionId,
          ...(resolvedDomain.pluginId ? { pluginId: resolvedDomain.pluginId } : {}),
          tool: {
            name: selectedTool.name,
            shortName: inferToolShortName(selectedTool.name),
          },
          result: toolResult,
        };
      })();

      printOutput(result, !!options.json, !!options.pretty);
    });
};

export const registerAgentCommand = (program: Command): void => {
  const mcpCommand = program
    .command('agent')
    .description('CLI for progressive domain loading and dynamic tool discovery')
    .option('--host <host>', 'Metro host', DEFAULT_METRO_HOST)
    .option('--port <port>', 'Metro port', String(DEFAULT_METRO_PORT))
    .option('--pretty', 'Pretty-print JSON output when --json is used');

  mcpCommand
    .command('targets')
    .description('List connected devices from Metro inspector')
    .option('-j, --json', 'Output JSON')
    .action(async (...args: unknown[]) => {
      const command = getActionCommand(args);
      const options = getConnectionOptions(command);
      const targets = (
        await callDaemon(process.cwd(), 'metro.targets', {
          host: options.host,
          port: options.port,
        })
      ).targets;
      const conciseTargets = targets.map((target) => ({
        id: target.id,
        name: target.name,
        description: target.description,
        app: target.appId,
        pageId: target.pageId,
        title: target.title,
      }));

      const payload = {
        count: conciseTargets.length,
        targets: conciseTargets,
      };

      printOutput(payload, !!options.json, !!options.pretty);
    });

  mcpCommand
    .command('kill')
    .description('Stop all Agent sessions and shut down the local daemon')
    .option('-j, --json', 'Output JSON')
    .action(async (...args: unknown[]) => {
      const command = getActionCommand(args);
      const options = getConnectionOptions(command);
      const result = await callRunningDaemon(process.cwd(), 'daemon.shutdown', undefined);

      printOutput(
        result ?? { stopped: true, stoppedSessions: 0, alreadyStopped: true },
        !!options.json,
        !!options.pretty,
      );
    });

  const sessionCommand = mcpCommand
    .command('session')
    .description('Manage long-lived Agent sessions')
    .option('--host <host>', 'Metro host', DEFAULT_METRO_HOST)
    .option('--port <port>', 'Metro port', String(DEFAULT_METRO_PORT))
    .option('--pretty', 'Pretty-print JSON output when --json is used');

  sessionCommand
    .command('create')
    .description('Create a new Agent session and start the daemon if needed')
    .option('-d, --deviceId <id>', 'Target Metro device ID')
    .option('-j, --json', 'Output JSON')
    .action(async (...args: unknown[]) => {
      const command = getActionCommand(args);
      const options = getConnectionOptions(command);
      const sessionOptions = command.optsWithGlobals<SessionCommandOptions>();
      const result = await callDaemon(process.cwd(), 'session.create', {
        host: options.host,
        port: options.port,
        deviceId: sessionOptions.deviceId,
      });
      printOutput(result, !!options.json, !!options.pretty);
    });

  sessionCommand
    .command('list')
    .description('List running Agent sessions')
    .option('-j, --json', 'Output JSON')
    .action(async (...args: unknown[]) => {
      const command = getActionCommand(args);
      const options = getConnectionOptions(command);
      const result = await callDaemon(process.cwd(), 'session.list', undefined);
      printOutput(result, !!options.json, !!options.pretty);
    });

  sessionCommand
    .command('show')
    .description('Show one Agent session')
    .argument('<sessionId>', 'Session ID')
    .option('-j, --json', 'Output JSON')
    .action(async (sessionId: string, ...args: unknown[]) => {
      const command = getActionCommand(args);
      const options = getConnectionOptions(command);
      const result = await callDaemon(process.cwd(), 'session.show', { sessionId });
      printOutput(result, !!options.json, !!options.pretty);
    });

  sessionCommand
    .command('stop')
    .description('Stop one Agent session')
    .argument('<sessionId>', 'Session ID')
    .option('-j, --json', 'Output JSON')
    .action(async (sessionId: string, ...args: unknown[]) => {
      const command = getActionCommand(args);
      const options = getConnectionOptions(command);
      const result = await callDaemon(process.cwd(), 'session.stop', { sessionId });
      printOutput(result, !!options.json, !!options.pretty);
    });

  mcpCommand
    .command('list-domains')
    .alias('domains')
    .description('List available static and plugin domains')
    .option('-f, --fields <csv>', `Fields to include (${DOMAIN_LIST_FIELDS.join(', ')})`)
    .option('-v, --verbose', 'Include all supported fields')
    .option('-n, --limit <n>', 'Page size (default 20, max 100)')
    .option('-c, --cursor <token>', 'Opaque cursor from previous page')
    .option('-j, --json', 'Output JSON')
    .requiredOption('-s, --session <id>', 'Target Agent session ID')
    .action(async (_args: ListDomainsOptions, command: Command) => {
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

      const result = await (async () => {
        const tools = (await callDaemon(process.cwd(), 'session.tools', { sessionId })).tools;
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
          sessionId,
          count: domains.length,
          items: paged.items,
          page: paged.page,
        };
      })();

      printOutput(result, !!options.json, !!options.pretty);
    });

  mcpCommand
    .command('load-domain')
    .alias('domain')
    .description('Load runtime-generated domain usage guide')
    .argument('<domain>', 'Domain name')
    .option('-j, --json', 'Output JSON')
    .requiredOption('-s, --session <id>', 'Target Agent session ID')
    .action(async (domainToken: string, command?: Command) => {
      const activeCommand = command as Command;
      const normalizedDomain = domainToken.trim();
      if (normalizedDomain === 'rozenite') {
        throw new Error(REMOVED_ROZENITE_DOMAIN_HINT);
      }

      const options = getConnectionOptions(activeCommand);
      const sessionId = getSessionId(activeCommand);
      const result = await (async () => {
        const { resolvedDomain, domainTools } = await resolveDomainContext(
          process.cwd(),
          sessionId,
          normalizedDomain,
        );
        const content = generateDomainGuide(resolvedDomain, domainTools);

        return {
          domain: resolvedDomain.id,
          kind: resolvedDomain.kind,
          ...(resolvedDomain.pluginId ? { pluginId: resolvedDomain.pluginId } : {}),
          sessionId,
          content,
        };
      })();

      printOutput(result, !!options.json, !!options.pretty);
    });

  mcpCommand
    .command('daemon')
    .description('Internal Agent daemon entrypoint')
    .requiredOption('--workspace <path>', 'Workspace path')
    .action(async (_args: unknown, command: Command) => {
      const { runAgentDaemonServer } = await import('./daemon-server.js');
      const options = command.optsWithGlobals<{
        workspace: string;
      }>();
      await runAgentDaemonServer({
        workspace: options.workspace,
      });
    });

  registerDynamicPluginDomainDispatcher(mcpCommand);
};
