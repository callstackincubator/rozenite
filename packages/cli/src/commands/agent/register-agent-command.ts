import { Command, Option } from 'commander';
import { createAgentClient } from '@rozenite/agent-sdk';
import { createAgentTransport } from '@rozenite/agent-sdk/transport';
import {
  DEFAULT_AGENT_HOST,
  DEFAULT_AGENT_PORT,
  parseFields,
  parseLimit,
  shapeToolResult,
  type JSONSchema7,
  type PageResult,
  type ToolAvailability,
} from '@rozenite/agent-shared';
import { printOutput } from './output.js';
import { formatAgentCommand, paginateListing } from './output-shaping.js';
import { getErrorMessage } from './error-message.js';
import { registerTapCommand } from './register-tap-command.js';
import {
  createOrReuseSession,
  findSessionToStop,
  getRequestedDevice,
  resolveAgentSession,
  type SessionSelection,
} from './session-resolution.js';
import {
  assertNoToolTokens,
  buildToolArguments,
  formatToolHelp,
  parseArgsJson,
  parseDomainInvocation,
  parseToolFlags,
  renderToolArguments,
  type DomainCliOptions,
} from './tool-flags.js';
import { getToolListMetadata, type ToolFieldSet } from './tool-metadata.js';

const REMOVED_ROZENITE_DOMAIN_HINT =
  'The `rozenite agent rozenite ...` path was removed. Use `rozenite agent <domain> ...`; run `rozenite agent domains` to list domains.';

/**
 * Discovery and call verbs from the previous grammar. They still parse
 * exactly as before (ADR 0005, decision 11) but are no longer documented.
 */
const LEGACY_LIST_VERBS = new Set(['tools', 'list-tools']);
const LEGACY_SCHEMA_VERBS = new Set(['schema', 'get-tool-schema']);
const LEGACY_CALL_VERBS = new Set(['call', 'call-tool']);
const isLegacyVerb = (token: string): boolean => {
  const normalized = token.trim().toLowerCase();
  return (
    LEGACY_LIST_VERBS.has(normalized) ||
    LEGACY_SCHEMA_VERBS.has(normalized) ||
    LEGACY_CALL_VERBS.has(normalized)
  );
};

type AgentGlobalOptions = SessionSelection & {
  host?: string;
  port?: string | number;
  pretty?: boolean;
  json?: boolean;
};

type ListingOptions = {
  fields?: string;
  limit?: string;
  cursor?: string;
  verbose?: boolean;
};

type Connection = {
  host: string;
  port: number;
  pretty: boolean;
};

type ToolListRow = {
  name: string;
  description: string;
  readOnly?: boolean;
  destructive?: boolean;
  idempotent?: boolean;
};

type DomainListRow = {
  id: string;
  kind: 'static' | 'plugin';
  availability: ToolAvailability;
  fallback?: string;
  pluginId?: string;
  slug?: string;
  description: string;
};

const TOOL_LIST_FIELDS = ['name', 'description', 'readOnly', 'destructive', 'idempotent'] as const;
const DOMAIN_LIST_FIELDS = [
  'id',
  'kind',
  'availability',
  'fallback',
  'pluginId',
  'slug',
  'description',
] as const;
// `availability` is a default field, not an opt-in one: an agent that has
// to ask for it to learn a domain does not work on this target will not
// ask, and will spend a turn finding out the hard way.
const DOMAIN_LIST_DEFAULT_FIELDS = ['id', 'kind', 'availability', 'fallback'] as const;

/** `rows` metadata for the CLI's own `targets` listing (ADR 0004, decision 5). */
const TARGET_ROWS = {
  fields: ['id', 'name', 'integration', 'deviceId', 'appId', 'pageId', 'title', 'description'],
  defaultFields: ['id', 'name', 'integration'],
} as const satisfies ToolFieldSet;

/** `rows` metadata for the CLI's own `session list` listing. */
const SESSION_ROWS = {
  fields: [
    'id',
    'deviceName',
    'status',
    'deviceId',
    'appId',
    'pageId',
    'integration',
    'createdAt',
    'lastActivityAt',
    'toolCount',
    'lastError',
  ],
  defaultFields: ['id', 'deviceName', 'status'],
} as const satisfies ToolFieldSet;

const FIELDS_DESCRIPTION = 'Columns to print, comma-separated, or `all`';

const projectSessionOutput = (
  session: Record<string, unknown>,
  versionCheck?: unknown,
): Record<string, unknown> => ({
  id: String(session.id ?? ''),
  deviceName: String(session.deviceName ?? ''),
  status: String(session.status ?? ''),
  ...(versionCheck ? { versionCheck: String(versionCheck) } : {}),
});

const getGlobals = (command: Command): AgentGlobalOptions =>
  command.optsWithGlobals<AgentGlobalOptions>();

const getConnection = (command: Command): Connection => {
  const options = getGlobals(command);
  return {
    host: options.host ?? DEFAULT_AGENT_HOST,
    port: Number(options.port ?? DEFAULT_AGENT_PORT),
    pretty: options.pretty ?? false,
  };
};

const getSessionSelection = (command: Command): SessionSelection => {
  const options = getGlobals(command);
  return { session: options.session, device: options.device, deviceId: options.deviceId };
};

/**
 * The global options a `next` command repeats (ADR 0005, decision 4): each
 * one the user typed, as typed, so the next page goes to the same server,
 * session and device. A value that came from a default or from the
 * environment is left out, since it still applies to the next run.
 */
const getTypedGlobalArgs = (command: Command): string[] => {
  const options = getGlobals(command);
  const typed = (key: keyof AgentGlobalOptions): boolean =>
    command.getOptionValueSourceWithGlobals(key) === 'cli';
  const args: string[] = [];

  if (typed('session') && options.session) {
    args.push('--session', options.session);
  }
  if (typed('device') && options.device) {
    args.push('--device', options.device);
  } else if (typed('deviceId') && options.deviceId) {
    args.push('--device', options.deviceId);
  }
  if (typed('host') && options.host) {
    args.push('--host', options.host);
  }
  if (typed('port') && options.port !== undefined) {
    args.push('--port', String(options.port));
  }
  if (typed('pretty') && options.pretty) {
    args.push('--pretty');
  }
  return args;
};

const outputAgentError = (command: Command, error: unknown): void => {
  printOutput({ error: { message: getErrorMessage(error) } }, true, getConnection(command).pretty);
  process.exitCode = 1;
};

const runAgentAction = async (command: Command, action: () => Promise<void>): Promise<void> => {
  try {
    await action();
  } catch (error) {
    outputAgentError(command, error);
  }
};

const getActionCommand = (args: unknown[]): Command => {
  const candidate = args[args.length - 1];
  if (!(candidate instanceof Command)) {
    throw new Error('Failed to resolve CLI command context');
  }

  return candidate;
};

/** Whether `--fields` itself was typed with a value. */
const hasTypedFields = (options: ListingOptions): boolean =>
  options.fields !== undefined && options.fields.trim().length > 0;

/** Whether the caller chose the columns, which turns off sparse-column elision. */
const hasExplicitFields = (options: ListingOptions): boolean =>
  !!options.verbose || hasTypedFields(options);

/** `--fields`/`--limit` as the user typed them, for a listing's `next` command. */
const getListingNextArgs = (options: ListingOptions, nextCursor: string): string[] => [
  ...(options.verbose
    ? ['--fields', 'all']
    : options.fields !== undefined
      ? ['--fields', options.fields]
      : []),
  ...(options.limit !== undefined ? ['--limit', options.limit] : []),
  '--cursor',
  nextCursor,
];

/**
 * Pages, projects and prints a listing the CLI builds itself. Its `next`
 * command is `commandArgs` with `--cursor` appended.
 */
const shapeListing = <T extends Record<string, unknown>>(
  rows: T[],
  input: {
    keyOf: (row: T) => string;
    scope: string;
    fieldSet: ToolFieldSet;
    options: ListingOptions;
    commandArgs: string[];
  },
): unknown => {
  const fields = parseFields(
    input.options.fields,
    input.fieldSet.fields,
    input.fieldSet.defaultFields ?? input.fieldSet.fields,
    !!input.options.verbose,
  );
  const paged: PageResult<T> = paginateListing(rows, {
    keyOf: input.keyOf,
    scope: input.scope,
    limit: parseLimit(input.options.limit),
    cursor: input.options.cursor,
  });

  return shapeToolResult(
    paged,
    fields,
    paged.page.nextCursor
      ? formatAgentCommand([
          ...input.commandArgs,
          ...getListingNextArgs(input.options, paged.page.nextCursor),
        ])
      : undefined,
    { elideNullColumns: !hasExplicitFields(input.options) },
  );
};

const addListingOptions = (command: Command): Command =>
  command
    .option('-f, --fields <csv>', FIELDS_DESCRIPTION)
    .option('-n, --limit <n>', 'Page size (default 20, max 100)')
    .option('-c, --cursor <token>', 'Continue from a previous page')
    .addOption(new Option('-v, --verbose', 'Same as --fields all').hideHelp());

/**
 * `rozenite agent` turns its own help option off so a tool can answer
 * `--help`; subcommands inherit that setting and turn theirs back on.
 */
const withHelp = (command: Command): Command => command.helpOption('-h, --help', 'Display help');

const openSession = async (command: Command) => {
  const connection = getConnection(command);
  const transport = createAgentTransport({ host: connection.host, port: connection.port });
  const { sessionId } = await resolveAgentSession(transport, getSessionSelection(command));
  return await createAgentClient({ host: connection.host, port: connection.port }).attachSession(
    sessionId,
  );
};

const DOMAIN_USAGE = [
  'Usage: rozenite agent <domain> [tool] [options]',
  '',
  "  rozenite agent <domain>                           List the domain's tools",
  '  rozenite agent <domain> <tool> [--<arg> <value>]  Call a tool',
  "  rozenite agent <domain> <tool> --help             Show a tool's arguments",
  "  rozenite agent <domain> <tool> --schema           Print a tool's input schema",
  '',
  'Run `rozenite agent domains` to list domains.',
  '',
].join('\n');

const LISTING_USAGE =
  'rozenite agent <domain> [--fields <csv|all>] [--limit <n>] [--cursor <token>]';

type DomainMode =
  | { kind: 'list' }
  | { kind: 'schema'; tool: string }
  | { kind: 'call'; tool: string }
  | { kind: 'help'; tool?: string };

const getDomainMode = (actionToken: string | undefined, cli: DomainCliOptions): DomainMode => {
  const verb = actionToken?.trim().toLowerCase();
  let mode: DomainMode;

  if (actionToken === undefined) {
    mode = cli.tool ? { kind: cli.schema ? 'schema' : 'call', tool: cli.tool } : { kind: 'list' };
  } else if (verb && LEGACY_LIST_VERBS.has(verb)) {
    mode = { kind: 'list' };
  } else if (verb && LEGACY_SCHEMA_VERBS.has(verb) && cli.tool) {
    mode = { kind: 'schema', tool: cli.tool };
  } else if (verb && LEGACY_CALL_VERBS.has(verb) && cli.tool) {
    mode = { kind: cli.schema ? 'schema' : 'call', tool: cli.tool };
  } else {
    if (cli.tool && cli.tool !== actionToken) {
      throw new Error(
        `Tool given twice: "${actionToken}" and --tool "${cli.tool}". Use: rozenite agent <domain> <tool>`,
      );
    }
    mode = { kind: cli.schema ? 'schema' : 'call', tool: actionToken };
  }

  if (cli.help) {
    return { kind: 'help', tool: mode.kind === 'list' ? undefined : mode.tool };
  }
  return mode;
};

const listDomainTools = async (
  command: Command,
  domainToken: string,
  cli: DomainCliOptions,
  toolTokens: string[],
): Promise<unknown> => {
  assertNoToolTokens(toolTokens, LISTING_USAGE);
  const session = await openSession(command);
  const domainTools = await session.tools.list({ domain: domainToken });
  const domainId = domainTools[0]?.domainId ?? domainToken;

  // Listings print short names; a short name two tools share keeps its
  // qualified form so every printed name still resolves to one tool.
  const shortNameCounts = new Map<string, number>();
  for (const tool of domainTools) {
    shortNameCounts.set(tool.shortName, (shortNameCounts.get(tool.shortName) ?? 0) + 1);
  }
  const rows = domainTools
    .map<ToolListRow>((tool) => ({
      name: shortNameCounts.get(tool.shortName) === 1 ? tool.shortName : tool.name,
      description: tool.description,
      ...(tool.readOnly !== undefined ? { readOnly: tool.readOnly } : {}),
      ...(tool.destructive !== undefined ? { destructive: tool.destructive } : {}),
      ...(tool.idempotent !== undefined ? { idempotent: tool.idempotent } : {}),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return shapeListing(rows, {
    keyOf: (row) => row.name,
    scope: `domain:${domainId}`,
    fieldSet: { fields: TOOL_LIST_FIELDS },
    options: cli,
    commandArgs: [domainId, ...getTypedGlobalArgs(command)],
  });
};

const getProperties = (inputSchema: JSONSchema7 | undefined): Record<string, unknown> =>
  inputSchema && typeof inputSchema.properties === 'object' && inputSchema.properties !== null
    ? inputSchema.properties
    : {};

const callDomainTool = async (
  command: Command,
  domainToken: string,
  toolToken: string,
  cli: DomainCliOptions,
  toolTokens: string[],
  help: boolean,
): Promise<{ text: string } | { result: unknown }> => {
  const session = await openSession(command);
  const resolvedTool = await session.tools.resolve({ domain: domainToken, tool: toolToken });
  const schema = resolvedTool.schema;
  const { pagination, rows, warning } = getToolListMetadata(schema);
  const fieldSet: ToolFieldSet | undefined = pagination ?? rows;

  if (help) {
    return {
      text: formatToolHelp({
        domain: resolvedTool.domainId,
        tool: schema.shortName,
        // A resolved schema carries no description; the listing does.
        description: (await session.tools.list({ domain: domainToken })).find(
          (tool) => tool.name === schema.name,
        )?.description,
        inputSchema: schema.inputSchema,
        fields: fieldSet,
        paged: !!pagination,
      }),
    };
  }

  if (warning) {
    process.stderr.write(`${warning}\n`);
  }

  const properties = getProperties(schema.inputSchema);
  const flagArgs = parseToolFlags(toolTokens, {
    toolLabel: toolToken,
    inputSchema: schema.inputSchema,
  });
  const toolArgs = buildToolArguments({
    argsJson: parseArgsJson(cli.args),
    flagArgs,
    limit: cli.limit,
    cursor: cli.cursor,
    acceptsPaging: {
      limit: !!pagination || 'limit' in properties,
      cursor: !!pagination || 'cursor' in properties,
    },
    toolLabel: toolToken,
    requireObject: !!pagination,
    onIgnored: (flag) => {
      process.stderr.write(`Note: ${toolToken} does not page; ${flag} was ignored.\n`);
    },
  });

  // `--fields` is new grammar and never worked here, so silently printing
  // everything would hide the mistake. `-v`/`--verbose` meant "all fields"
  // and was ignored for such a tool before; it still is (ADR 0005, decision 11).
  if (!fieldSet && hasTypedFields(cli)) {
    throw new Error(`Tool "${toolToken}" does not declare row fields; --fields does not apply.`);
  }

  // Validated before the call, so a typo in --fields costs no device round trip.
  const fields = fieldSet
    ? parseFields(
        cli.fields,
        fieldSet.fields,
        fieldSet.defaultFields ?? fieldSet.fields,
        !!cli.verbose,
      )
    : undefined;
  const toolResult = await resolvedTool.call(toolArgs);

  if (!fieldSet || !fields) {
    return { result: toolResult };
  }

  const elideNullColumns = !hasExplicitFields(cli);
  if (!pagination) {
    return {
      result: shapeToolResult(toolResult, fields, undefined, {
        paged: false,
        itemsKey: rows?.key,
        elideNullColumns,
      }),
    };
  }

  const page =
    typeof toolResult === 'object' && toolResult !== null
      ? (toolResult as { page?: { hasMore?: unknown; nextCursor?: unknown } }).page
      : undefined;
  const nextCursor =
    page?.hasMore === true && typeof page.nextCursor === 'string' ? page.nextCursor : undefined;

  return {
    result: shapeToolResult(
      toolResult,
      fields,
      nextCursor
        ? formatAgentCommand([
            resolvedTool.domainId,
            toolToken,
            ...renderToolArguments(toolArgs as Record<string, unknown>, schema.inputSchema),
            ...(cli.verbose
              ? ['--fields', 'all']
              : cli.fields !== undefined
                ? ['--fields', cli.fields]
                : []),
            ...getTypedGlobalArgs(command),
            '--cursor',
            nextCursor,
          ])
        : undefined,
      { itemsKey: pagination.itemsKey, meta: pagination.meta, elideNullColumns },
    ),
  };
};

/**
 * `rozenite agent <domain> [tool] [--<arg> <value>…]`, plus every spelling
 * of the previous grammar (`<domain> tools`, `<domain> schema --tool`,
 * `<domain> call --tool --args`).
 */
const runDomainCommand = async (command: Command, tokens: string[]): Promise<void> => {
  const { positionals, cli, toolTokens } = parseDomainInvocation(tokens);
  const [domainToken, actionToken, ...extra] = positionals;

  // `rozenite agent help` alone prints this command's help; a plugin domain
  // named `help` is still reachable for its tools (`rozenite agent help <tool>`).
  if (domainToken === undefined || (domainToken === 'help' && actionToken === undefined)) {
    command.outputHelp();
    return;
  }

  await runAgentAction(command, async () => {
    if (domainToken === 'rozenite') {
      throw new Error(REMOVED_ROZENITE_DOMAIN_HINT);
    }
    if (isLegacyVerb(domainToken)) {
      throw new Error(
        `Missing domain before "${domainToken}". Use: rozenite agent <domain> [tool]; run \`rozenite agent domains\` to list domains.`,
      );
    }
    if (extra.length > 0) {
      throw new Error(
        `Unexpected argument "${extra[0]}". Use: rozenite agent <domain> <tool> [--<arg> <value>…]`,
      );
    }

    const mode = getDomainMode(actionToken, cli);
    const connection = getConnection(command);

    if (mode.kind === 'help' && !mode.tool) {
      process.stdout.write(DOMAIN_USAGE);
      return;
    }

    if (mode.kind === 'list') {
      printOutput(
        await listDomainTools(command, domainToken, cli, toolTokens),
        true,
        connection.pretty,
      );
      return;
    }

    if (mode.kind === 'schema') {
      assertNoToolTokens(toolTokens, 'rozenite agent <domain> <tool> --schema');
      const session = await openSession(command);
      printOutput(
        await session.tools.getSchema({ domain: domainToken, tool: mode.tool }),
        true,
        connection.pretty,
      );
      return;
    }

    const outcome = await callDomainTool(
      command,
      domainToken,
      mode.tool!,
      cli,
      toolTokens,
      mode.kind === 'help',
    );
    if ('text' in outcome) {
      process.stdout.write(outcome.text);
      return;
    }
    printOutput(outcome.result, true, connection.pretty);
  });
};

const AGENT_HELP_EXAMPLES = `
Examples:
  rozenite agent domains                             List domains
  rozenite agent console                             List the console tools
  rozenite agent console getMessages --levels error  Call a tool
  rozenite agent console getMessages --help          Show a tool's arguments
  rozenite agent session stop                        Stop the session when done

The session is created on first use for the only connected device; pass
--device <id> (or set ROZENITE_DEVICE) when several are connected.
`;

export const registerAgentCommand = (program: Command): void => {
  const agentCommand = program
    .command('agent')
    .description('Inspect and drive a running app through its domains and tools')
    .usage('<domain> [tool] [--<arg> <value>...] | <command>')
    .argument('[domain]', 'Domain to list or call')
    .argument('[tool]', "Tool to call; omit it to list the domain's tools")
    .argument('[args...]', 'Tool arguments as --<name> <value>')
    .option('--host <host>', 'Metro host', DEFAULT_AGENT_HOST)
    .option('--port <port>', 'Metro port', String(DEFAULT_AGENT_PORT))
    .option('-s, --session <id>', 'Session to use (default: resolved from --device)')
    .option('--device <id>', 'Device whose session to use (default: the only connected one)')
    .addOption(new Option('-d, --deviceId <id>', 'Same as --device').hideHelp())
    .option('--pretty', 'Indent JSON output (the default on a terminal)')
    .addOption(new Option('-j, --json', 'No-op; agent commands always print JSON').hideHelp())
    // `--help` is read by the domain command itself, so that
    // `rozenite agent <domain> <tool> --help` can describe the tool.
    .helpOption(false)
    .allowUnknownOption()
    .configureHelp({ showGlobalOptions: true })
    .addHelpText('after', AGENT_HELP_EXAMPLES)
    .action(async (...args: unknown[]) => {
      const command = getActionCommand(args);
      await runDomainCommand(command, [...command.args]);
    });

  addListingOptions(
    withHelp(agentCommand.command('targets')).description(
      'List connected targets and the integration serving each',
    ),
  ).action(async (...args: unknown[]) => {
    const command = getActionCommand(args);
    await runAgentAction(command, async () => {
      const connection = getConnection(command);
      const targets = await createAgentClient({
        host: connection.host,
        port: connection.port,
      }).targets.list();

      printOutput(
        shapeListing(targets as unknown as Record<string, unknown>[], {
          keyOf: (target) => String(target.id),
          scope: 'targets',
          fieldSet: TARGET_ROWS,
          options: command.opts<ListingOptions>(),
          commandArgs: ['targets', ...getTypedGlobalArgs(command)],
        }),
        true,
        connection.pretty,
      );
    });
  });

  registerTapCommand(agentCommand);

  const sessionCommand = withHelp(agentCommand.command('session')).description(
    'Manage device-keyed agent sessions (created on first use)',
  );

  sessionCommand
    .command('create')
    .description('Create or reuse the agent session for a device')
    .action(async (...args: unknown[]) => {
      const command = getActionCommand(args);
      await runAgentAction(command, async () => {
        const connection = getConnection(command);
        const transport = createAgentTransport({ host: connection.host, port: connection.port });
        const result = await createOrReuseSession(
          transport,
          getRequestedDevice(getSessionSelection(command)),
        );
        printOutput(
          projectSessionOutput(
            result.session as unknown as Record<string, unknown>,
            result.versionCheck,
          ),
          true,
          connection.pretty,
        );
      });
    });

  addListingOptions(
    sessionCommand.command('list').description('List running agent sessions'),
  ).action(async (...args: unknown[]) => {
    const command = getActionCommand(args);
    await runAgentAction(command, async () => {
      const connection = getConnection(command);
      const result = await createAgentTransport({
        host: connection.host,
        port: connection.port,
      }).listSessions();
      printOutput(
        shapeListing(result.sessions as unknown as Record<string, unknown>[], {
          keyOf: (session) => String(session.id),
          scope: 'sessions',
          fieldSet: SESSION_ROWS,
          options: command.opts<ListingOptions>(),
          commandArgs: ['session', 'list', ...getTypedGlobalArgs(command)],
        }),
        true,
        connection.pretty,
      );
    });
  });

  sessionCommand
    .command('show')
    .description('Show one agent session')
    .argument('<sessionId>', 'Session ID')
    .action(async (sessionId: string, ...args: unknown[]) => {
      const command = getActionCommand(args);
      await runAgentAction(command, async () => {
        const connection = getConnection(command);
        const result = await createAgentTransport({
          host: connection.host,
          port: connection.port,
        }).getSession(sessionId);
        printOutput(
          projectSessionOutput(result.session as unknown as Record<string, unknown>),
          true,
          connection.pretty,
        );
      });
    });

  sessionCommand
    .command('stop')
    .description('Stop an agent session (default: the one other commands would use)')
    .argument('[sessionId]', 'Session ID')
    .action(async (sessionId: string | undefined, ...args: unknown[]) => {
      const command = getActionCommand(args);
      await runAgentAction(command, async () => {
        const connection = getConnection(command);
        const transport = createAgentTransport({ host: connection.host, port: connection.port });
        const id = sessionId ?? (await findSessionToStop(transport, getSessionSelection(command)));
        printOutput(await transport.stopSession(id), true, connection.pretty);
      });
    });

  const listDomains = async (...args: unknown[]) => {
    const command = getActionCommand(args);
    await runAgentAction(command, async () => {
      const connection = getConnection(command);
      const session = await openSession(command);
      const domains = (await session.domains.list())
        .map<DomainListRow>((domain) => ({
          id: domain.id,
          kind: domain.kind,
          availability: domain.availability ?? 'supported',
          fallback: domain.fallback,
          pluginId: domain.pluginId,
          slug: domain.slug,
          description: domain.description,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));

      printOutput(
        shapeListing(domains as unknown as Record<string, unknown>[], {
          keyOf: (domain) => String(domain.id),
          scope: 'domains',
          fieldSet: { fields: DOMAIN_LIST_FIELDS, defaultFields: DOMAIN_LIST_DEFAULT_FIELDS },
          options: command.opts<ListingOptions>(),
          commandArgs: ['domains', ...getTypedGlobalArgs(command)],
        }),
        true,
        connection.pretty,
      );
    });
  };

  addListingOptions(
    withHelp(agentCommand.command('domains')).description(
      'List available built-in and plugin domains',
    ),
  ).action(listDomains);
  // The previous spelling, accepted and no longer listed (ADR 0005, decision 11).
  addListingOptions(withHelp(agentCommand.command('list-domains', { hidden: true }))).action(
    listDomains,
  );
};
