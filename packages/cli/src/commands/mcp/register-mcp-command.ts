import { Command } from 'commander';
import { DEFAULT_METRO_HOST, DEFAULT_METRO_PORT, STATIC_DOMAINS } from './constants.js';
import { createHttpMCPClient, type HttpMCPClient } from './http-client.js';
import {
  inferPluginId,
  inferToolShortName,
  buildRuntimePluginDomains,
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

const REMOVED_ROZENITE_DOMAIN_HINT =
  'The `rozenite mcp rozenite ...` command path was removed. Use `rozenite mcp <plugin-domain> ...`; run `rozenite mcp list-domains --json`.';
const PLUGIN_DOMAIN_GUIDE_MAX_TOOLS = 20;
const DOMAIN_ACTIONS = ['list-tools', 'get-tool-schema', 'call-tool'] as const;

type DomainAction = (typeof DOMAIN_ACTIONS)[number];

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

const getPluginTools = (tools: MCPTool[], plugin: string): MCPTool[] => {
  return tools.filter((tool) => inferPluginId(tool.name) === plugin);
};

const resolvePluginTool = (
  pluginTools: MCPTool[],
  plugin: string,
  toolName: string,
): MCPTool => {
  const exactMatch = pluginTools.find((tool) => tool.name === toolName);
  const shortMatches = pluginTools.filter(
    (tool) => inferToolShortName(tool.name) === toolName,
  );

  const selectedTool = exactMatch || (shortMatches.length === 1 ? shortMatches[0] : null);
  if (!selectedTool) {
    if (shortMatches.length > 1) {
      const fullNames = formatLimitedList(shortMatches.map((tool) => tool.name));
      throw new Error(
        `Ambiguous tool name "${toolName}" for plugin "${plugin}". Matching full names: ${fullNames}.`,
      );
    }
    const available = formatLimitedList(pluginTools.map((tool) => tool.name));
    throw new Error(
      `Tool "${toolName}" not found for plugin "${plugin}". Available tools: ${available || 'none'}. Run \`rozenite mcp list-domains --limit 20 --json\`, then \`rozenite mcp <pluginDomain> list-tools --limit 20 --json\`, and finally \`rozenite mcp <pluginDomain> get-tool-schema --tool <name> --json\`.`,
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
    `Unknown domain "${token}".${suggestionsText} Run \`rozenite mcp list-domains --limit 20 --json\` to see available domains.`,
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
  if (DOMAIN_ACTIONS.includes(value as DomainAction)) {
    return value as DomainAction;
  }

  return null;
};

const generatePluginDomainGuide = (
  domain: DomainDefinition,
  pluginTools: MCPTool[],
): string => {
  const visibleTools = pluginTools.slice(0, PLUGIN_DOMAIN_GUIDE_MAX_TOOLS);
  const truncated = pluginTools.length > visibleTools.length;

  const lines: string[] = [
    `# Plugin Domain: ${domain.id}`,
    '',
    'Use this domain for runtime plugin tools discovered from the connected device.',
    '',
    '## Domain Metadata',
    `- Domain token: \`${domain.id}\``,
    `- Plugin ID: \`${domain.pluginId || 'unknown'}\``,
    '',
    '## Command Surface',
    `- \`rozenite mcp ${domain.id} list-tools --limit 20 --json [--deviceId <id>]\``,
    `- \`rozenite mcp ${domain.id} get-tool-schema --tool <name> --json [--deviceId <id>]\``,
    `- \`rozenite mcp ${domain.id} call-tool --tool <name> --args '<json>' --json [--deviceId <id>]\``,
    '',
    '## Tool Naming Guidance',
    '- `--tool` accepts a full name or short name.',
    '- If a short name is ambiguous, use the full tool name.',
    '- Prefer `get-tool-schema` before first invocation.',
    '',
    '## Available Tools',
  ];

  if (visibleTools.length === 0) {
    lines.push('- No tools are currently available for this plugin domain.');
  } else {
    for (const tool of visibleTools) {
      lines.push(
        `- \`${tool.name}\` (short: \`${inferToolShortName(tool.name)}\`)`,
      );
    }
  }

  if (truncated) {
    lines.push(
      `- Output truncated to ${PLUGIN_DOMAIN_GUIDE_MAX_TOOLS} tools (total: ${pluginTools.length}).`,
    );
  }

  lines.push('');
  lines.push('## Example');
  lines.push(`1. \`rozenite mcp ${domain.id} list-tools --limit 20 --json\``);
  lines.push(`2. \`rozenite mcp ${domain.id} get-tool-schema --tool <name> --json\``);
  lines.push(
    `3. \`rozenite mcp ${domain.id} call-tool --tool <name> --args '{}' --json\``,
  );

  return lines.join('\n');
};

const registerDynamicPluginDomainDispatcher = (mcpCommand: Command): void => {
  mcpCommand
    .command('* [action] [rest...]')
    .description('Dynamic plugin domain commands')
    .option('--tool <name>', 'Tool name or short tool name')
    .option('--args <json>', 'Tool arguments as JSON object', '{}')
    .option('--fields <csv>', `Fields to include (${TOOL_LIST_FIELDS.join(', ')})`)
    .option('--verbose', 'Include all supported fields')
    .option('--limit <n>', 'Page size (default 20, max 100)')
    .option('--cursor <token>', 'Opaque cursor from previous page')
    .option('--json', 'Output JSON')
    .option('--deviceId <id>', 'Target Metro device ID')
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
        const isActionInDomainPosition = DOMAIN_ACTIONS.includes(
          domainToken as DomainAction,
        );
        if (isActionInDomainPosition) {
          throw new Error(
            `Missing domain before action "${domainToken}". Use \`rozenite mcp <domain> ${domainToken} --json\`. Discover domains with \`rozenite mcp list-domains --json\`.`,
          );
        }

        throw new Error(
          `Missing action for domain "${domainToken}". Expected one of: ${DOMAIN_ACTIONS.join(', ')}. Use \`rozenite mcp ${domainToken} <action> --json\`.`,
        );
      }

      const action = actionTokenString ? toDomainAction(actionTokenString) : null;
      if (!action) {
        throw new Error(
          `Unknown domain action "${actionTokenString}". Expected one of: ${DOMAIN_ACTIONS.join(', ')}`,
        );
      }

      const dynamicOptions = activeCommand.optsWithGlobals<DynamicDomainCommandOptions>();
      const options = getConnectionOptions(activeCommand);

      const result = await withClient(options, async (client, selectedDeviceId) => {
        const tools = await client.getTools();
        const runtimeDomains = buildRuntimePluginDomains(tools);

        const resolvedDomain = resolveDomainToken(domainToken, runtimeDomains);
        if (!resolvedDomain || !resolvedDomain.pluginId) {
          throw formatUnknownDomainError(domainToken, [...STATIC_DOMAINS, ...runtimeDomains]);
        }

        const pluginTools = getPluginTools(tools, resolvedDomain.pluginId);

        if (action === 'list-tools') {
          const fields = parseFields(
            dynamicOptions.fields,
            TOOL_LIST_FIELDS,
            TOOL_LIST_DEFAULT_FIELDS,
            !!dynamicOptions.verbose,
          );
          const limit = parseLimit(dynamicOptions.limit);
          const rows = pluginTools
            .map<ToolListRow>((tool) => ({
              name: tool.name,
              shortName: inferToolShortName(tool.name),
              description: tool.description,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
          const projected = projectRows(rows, fields);
          const paged = paginateRows(projected, {
            kind: 'tools',
            scope: `plugin:${resolvedDomain.pluginId}`,
            limit,
            cursor: dynamicOptions.cursor,
          });

          return {
            domain: resolvedDomain.id,
            selectedDeviceId,
            pluginId: resolvedDomain.pluginId,
            items: paged.items,
            page: paged.page,
          };
        }

        if (!dynamicOptions.tool) {
          throw new Error('--tool is required for get-tool-schema and call-tool');
        }

        const selectedTool = resolvePluginTool(
          pluginTools,
          resolvedDomain.pluginId,
          dynamicOptions.tool,
        );

        if (action === 'get-tool-schema') {
          return {
            domain: resolvedDomain.id,
            selectedDeviceId,
            pluginId: resolvedDomain.pluginId,
            tool: {
              name: selectedTool.name,
              shortName: inferToolShortName(selectedTool.name),
              description: selectedTool.description,
              inputSchema: selectedTool.inputSchema,
            },
          };
        }

        const parsedArgs = parseJsonArgs(dynamicOptions.args);
        const payload = {
          ...(parsedArgs as Record<string, unknown>),
          ...(dynamicOptions.deviceId ? { deviceId: selectedDeviceId } : {}),
        };
        const toolResult = await client.callTool(selectedTool.name, payload);

        return {
          domain: resolvedDomain.id,
          selectedDeviceId,
          pluginId: resolvedDomain.pluginId,
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
    .option('--json', 'Output JSON')
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
    .description('List available runtime plugin domains')
    .option('--fields <csv>', `Fields to include (${DOMAIN_LIST_FIELDS.join(', ')})`)
    .option('--verbose', 'Include all supported fields')
    .option('--limit <n>', 'Page size (default 20, max 100)')
    .option('--cursor <token>', 'Opaque cursor from previous page')
    .option('--json', 'Output JSON')
    .option('--deviceId <id>', 'Target Metro device ID')
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
    .description('Load runtime-generated domain usage guide')
    .argument('<domain>', 'Domain name')
    .option('--json', 'Output JSON')
    .option('--deviceId <id>', 'Target Metro device ID')
    .action(async (domainToken: string, command?: Command) => {
      const activeCommand = command as Command;
      const normalizedDomain = domainToken.trim();
      if (normalizedDomain === 'rozenite') {
        throw new Error(REMOVED_ROZENITE_DOMAIN_HINT);
      }

      const options = getConnectionOptions(activeCommand);
      const result = await withClient(options, async (client, selectedDeviceId) => {
        const tools = await client.getTools();
        const runtimeDomains = buildRuntimePluginDomains(tools);
        const resolvedDomain = resolveDomainToken(normalizedDomain, runtimeDomains);

        if (!resolvedDomain || !resolvedDomain.pluginId) {
          throw formatUnknownDomainError(normalizedDomain, [...STATIC_DOMAINS, ...runtimeDomains]);
        }

        const pluginTools = getPluginTools(tools, resolvedDomain.pluginId);
        const content = generatePluginDomainGuide(resolvedDomain, pluginTools);

        return {
          domain: resolvedDomain.id,
          kind: resolvedDomain.kind,
          pluginId: resolvedDomain.pluginId,
          selectedDeviceId,
          content,
        };
      });

      printOutput(result, !!options.json, !!options.pretty);
    });

  registerDynamicPluginDomainDispatcher(mcpCommand);
};
