import { Command } from 'commander';
import { createAgentClient } from '@rozenite/agent-sdk';
import { createAgentTransport } from '@rozenite/agent-sdk/transport';
import {
  DEFAULT_AGENT_HOST,
  DEFAULT_AGENT_PORT,
} from '@rozenite/agent-shared';
import { printOutput } from './output.js';
import {
  paginateRows,
  parseFields,
  parseLimit,
  projectRows,
} from './output-shaping.js';
import { getErrorMessage } from './error-message.js';
import { getPackageJSON } from '../../package-json.js';

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
  deviceName: string;
  status: string;
  versionCheck?: string;
};

const DEFAULT_METRO_HOST = DEFAULT_AGENT_HOST;
const DEFAULT_METRO_PORT = DEFAULT_AGENT_PORT;

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
  versionCheck?: unknown,
): AgentSessionOutput => ({
  id: String(session.id ?? ''),
  deviceName: String(session.deviceName ?? ''),
  status: String(session.status ?? ''),
  ...(versionCheck
    ? {
        versionCheck: String(versionCheck),
      }
    : {}),
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

const parsePositiveIntOption = (
  rawValue: string | undefined,
  optionName: string,
): number | undefined => {
  if (!rawValue) {
    return undefined;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${optionName} must be a positive integer`);
  }

  return parsed;
};

const resolveAutoPaginationConfig = (options: DynamicDomainCommandOptions) => {
  const pagesLimit = parsePositiveIntOption(options.pages, '--pages');
  const maxItems = parsePositiveIntOption(options.maxItems, '--max-items');
  if (maxItems !== undefined && pagesLimit === undefined) {
    throw new Error('--max-items requires --pages');
  }

  return {
    ...(pagesLimit ? { pagesLimit } : {}),
    ...(maxItems ? { maxItems } : {}),
  };
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
          const client = createAgentClient({
            host: options.host,
            port: options.port,
          });
          const session = await client.attachSession(sessionId);

          const result = await (async () => {
            if (action === 'list-tools') {
              const fields = parseFields(
                dynamicOptions.fields,
                TOOL_LIST_FIELDS,
                TOOL_LIST_DEFAULT_FIELDS,
                !!dynamicOptions.verbose,
              );
              const limit = parseLimit(dynamicOptions.limit);
              const rows = (
                await session.tools.list({
                  domain: domainToken,
                })
              )
                .map<ToolListRow>((tool) => ({
                  name: tool.name,
                  shortName: tool.shortName,
                  description: tool.description,
                }))
                .sort((a, b) => a.name.localeCompare(b.name));
              const projected = projectRows(rows, fields);
              const paged = paginateRows(projected, {
                kind: 'tools',
                scope: `domain:${domainToken}`,
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

            if (action === 'get-tool-schema') {
              return await session.tools.getSchema({
                domain: domainToken,
                tool: dynamicOptions.tool,
              });
            }

            const parsedArgs = parseJsonArgs(dynamicOptions.args);
            const autoPagination = resolveAutoPaginationConfig(dynamicOptions);
            return await session.tools.call({
              domain: domainToken,
              tool: dynamicOptions.tool,
              args: parsedArgs,
              autoPaginate: autoPagination,
            });
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
        const targets = await createAgentClient({
          host: options.host,
          port: options.port,
        }).targets.list();
        const conciseTargets = targets.map((target) => ({
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
        const transport = createAgentTransport({
          host: options.host,
          port: options.port,
        });
        const result = await transport.createSession({
          deviceId: sessionOptions.deviceId,
          cliVersion: getPackageJSON().version,
        });
        printOutput(
          projectSessionOutput(result.session, result.versionCheck),
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
        const result = await createAgentTransport({
          host: options.host,
          port: options.port,
        }).listSessions();
        printOutput(
          result.sessions.map((session) =>
            projectSessionOutput(session as Record<string, unknown>),
          ),
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
        const result = await createAgentTransport({
          host: options.host,
          port: options.port,
        }).getSession(sessionId);
        printOutput(
          projectSessionOutput(result.session as Record<string, unknown>),
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
        const result = await createAgentTransport({
          host: options.host,
          port: options.port,
        }).stopSession(sessionId);
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
        const client = createAgentClient({
          host: options.host,
          port: options.port,
        });
        const session = await client.attachSession(sessionId);

        const result = await (async () => {
          const domains = (await session.domains.list())
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
