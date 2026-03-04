import { Command } from 'commander';
import { DEFAULT_METRO_HOST, DEFAULT_METRO_PORT, STATIC_DOMAINS } from './constants.js';
import { createHttpMCPClient, type HttpMCPClient } from './http-client.js';
import {
  inferToolShortName,
  buildRuntimePluginDomains,
  getDomainToolsByDefinition,
  resolveDomainToken,
} from './domain-utils.js';
import { getMetroTargets, resolveTargetDeviceId } from './metro.js';
import { printOutput } from './output.js';
import type { MCPTool, DomainDefinition } from './types.js';
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

const REMOVED_ROZENITE_DOMAIN_HINT =
  'The `rozenite mcp rozenite ...` path was removed. Use `rozenite mcp <domain> ...`; run `rozenite mcp domains -j`.';
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
  deviceId?: string;
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
    deviceId: options.deviceId,
  };
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

const withClient = async <T>(
  options: CommonOptions,
  handler: (client: HttpMCPClient, selectedDeviceId: string) => Promise<T>,
): Promise<T> => {
  const { deviceId } = await resolveTargetDeviceId(
    options.host,
    options.port,
    options.deviceId,
  );

  const client = createHttpMCPClient(options.host, options.port);
  try {
    await client.connect();
    return await handler(client, deviceId);
  } finally {
    client.close();
  }
};

const resolveDomainTool = (
  domainTools: MCPTool[],
  domainLabel: string,
  toolName: string,
): MCPTool => {
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
      `Tool "${toolName}" not found for domain "${domainLabel}". Available: ${available || 'none'}. Hint: rozenite mcp ${domainLabel} tools -j`,
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
    `Unknown domain "${token}".${suggestionsText} Run \`rozenite mcp domains -j\` to list available domains.`,
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
  client: HttpMCPClient,
  domainToken: string,
): Promise<{ resolvedDomain: DomainDefinition; domainTools: MCPTool[] }> => {
  const tools = await client.getTools();
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
  domainTools: MCPTool[],
): string => {
  const visibleTools = domainTools.slice(0, PLUGIN_DOMAIN_GUIDE_MAX_TOOLS);
  const truncated = domainTools.length > visibleTools.length;

  const lines: string[] = [
    `# Domain: ${domain.id}`,
    '',
    domain.kind === 'plugin'
      ? 'Runtime plugin tools discovered from the connected device.'
      : 'Built-in MCP tools discovered from the connected device.',
    '',
    '## Metadata',
    `- Token: \`${domain.id}\``,
    `- Kind: \`${domain.kind}\``,
    ...(domain.pluginId ? [`- Plugin ID: \`${domain.pluginId}\``] : []),
    '',
    '## Commands',
    `- \`rozenite mcp ${domain.id} tools -n 20 -j [--deviceId <id>]\``,
    `- \`rozenite mcp ${domain.id} schema -t <name> -j [--deviceId <id>]\``,
    `- \`rozenite mcp ${domain.id} call -t <name> -a '<json>' -j [--deviceId <id>] [-p <n>] [-m <n>]\``,
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
    .option('-d, --deviceId <id>', 'Target Metro device ID')
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
            `Missing domain before action "${domainToken}". Use: rozenite mcp <domain> ${domainToken} -j`,
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

      const result = await withClient(options, async (client, selectedDeviceId) => {
        const { resolvedDomain, domainTools } = await resolveDomainContext(client, domainToken);

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
            selectedDeviceId,
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
            selectedDeviceId,
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
        const payload = {
          ...(parsedArgs as Record<string, unknown>),
          ...(dynamicOptions.deviceId ? { deviceId: selectedDeviceId } : {}),
        };
        const toolResult = await callToolWithOptionalPagination(
          client,
          selectedTool.name,
          payload,
          autoPagination,
        );

        return {
          domain: resolvedDomain.id,
          selectedDeviceId,
          ...(resolvedDomain.pluginId ? { pluginId: resolvedDomain.pluginId } : {}),
          tool: {
            name: selectedTool.name,
            shortName: inferToolShortName(selectedTool.name),
          },
          result: toolResult,
        };
      });

      printOutput(result, !!options.json, !!options.pretty);
    });
};

export const registerMCPCommand = (program: Command): void => {
  const mcpCommand = program
    .command('mcp')
    .description('MCP-like CLI for progressive domain loading and dynamic tool discovery')
    .option('--host <host>', 'Metro host', DEFAULT_METRO_HOST)
    .option('--port <port>', 'Metro port', String(DEFAULT_METRO_PORT))
    .option('--pretty', 'Pretty-print JSON output when --json is used');

  mcpCommand
    .command('targets')
    .description('List connected devices from MCP backend')
    .option('-j, --json', 'Output JSON')
    .action(async (_args, command: Command) => {
      const options = getConnectionOptions(command);
      const targets = await getMetroTargets(options.host, options.port);
      const conciseTargets = targets.map((target) => ({
        id: target.id,
        name: target.name,
        reactNativeVersion: target.reactNativeVersion,
        app: target.app,
        platform: target.platform,
        runtime: target.runtime,
        type: target.type,
        description: target.description,
      }));

      const payload = {
        count: conciseTargets.length,
        targets: conciseTargets,
      };

      printOutput(payload, !!options.json, !!options.pretty);
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
    .option('-d, --deviceId <id>', 'Target Metro device ID')
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

      const result = await withClient(options, async (client, selectedDeviceId) => {
        const tools = await client.getTools();
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
          selectedDeviceId,
          count: domains.length,
          items: paged.items,
          page: paged.page,
        };
      });

      printOutput(result, !!options.json, !!options.pretty);
    });

  mcpCommand
    .command('load-domain')
    .alias('domain')
    .description('Load runtime-generated domain usage guide')
    .argument('<domain>', 'Domain name')
    .option('-j, --json', 'Output JSON')
    .option('-d, --deviceId <id>', 'Target Metro device ID')
    .action(async (domainToken: string, command?: Command) => {
      const activeCommand = command as Command;
      const normalizedDomain = domainToken.trim();
      if (normalizedDomain === 'rozenite') {
        throw new Error(REMOVED_ROZENITE_DOMAIN_HINT);
      }

      const options = getConnectionOptions(activeCommand);
      const result = await withClient(options, async (client, selectedDeviceId) => {
        const { resolvedDomain, domainTools } = await resolveDomainContext(client, normalizedDomain);
        const content = generateDomainGuide(resolvedDomain, domainTools);

        return {
          domain: resolvedDomain.id,
          kind: resolvedDomain.kind,
          ...(resolvedDomain.pluginId ? { pluginId: resolvedDomain.pluginId } : {}),
          selectedDeviceId,
          content,
        };
      });

      printOutput(result, !!options.json, !!options.pretty);
    });

  registerDynamicPluginDomainDispatcher(mcpCommand);
};
