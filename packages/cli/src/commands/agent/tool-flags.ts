/**
 * Flags for `rozenite agent <domain> <tool> [--<arg> <value>…]`, derived from
 * the tool's `inputSchema` (ADR 0005, decisions 1 and 10).
 *
 * Parsing happens in two passes because a tool's flags are only known once
 * its schema has been fetched:
 *
 * 1. {@link parseDomainInvocation} reads the positionals and the flags the
 *    CLI owns, which mean the same thing for every tool, and sets every
 *    other token aside untouched.
 * 2. {@link parseToolFlags} reads the set-aside tokens against the schema.
 */
import { parseLimit, type JSONSchema7 } from '@rozenite/agent-shared';

/**
 * Flags the CLI owns on every agent command. A tool argument with one of
 * these names is never turned into a flag; it is reachable through
 * `--args`.
 */
export const CLI_OWNED_FLAGS: readonly string[] = [
  'session',
  'device',
  'host',
  'port',
  'pretty',
  'fields',
  'limit',
  'cursor',
  'args',
  'schema',
];

/**
 * Older or generic spellings the CLI still accepts on a domain command.
 * They are never derived from a schema either, for the same reason.
 */
const COMPATIBILITY_FLAGS: readonly string[] = ['tool', 'verbose', 'json', 'deviceId', 'help'];

const NON_DERIVABLE_FLAGS = new Set([...CLI_OWNED_FLAGS, ...COMPATIBILITY_FLAGS]);

export type DomainCliOptions = {
  fields?: string;
  limit?: string;
  cursor?: string;
  args?: string;
  tool?: string;
  schema?: boolean;
  verbose?: boolean;
  help?: boolean;
};

type CliFlagSpec = { key: keyof DomainCliOptions; takesValue: boolean };

/**
 * The CLI-owned flags read on a domain command. `--session`, `--device`,
 * `--host`, `--port` and `--pretty` are not here: they belong to
 * `rozenite agent` itself and are read before this runs.
 */
const DOMAIN_CLI_FLAGS: Record<string, CliFlagSpec> = {
  '--fields': { key: 'fields', takesValue: true },
  '-f': { key: 'fields', takesValue: true },
  '--limit': { key: 'limit', takesValue: true },
  '-n': { key: 'limit', takesValue: true },
  '--cursor': { key: 'cursor', takesValue: true },
  '-c': { key: 'cursor', takesValue: true },
  '--args': { key: 'args', takesValue: true },
  '-a': { key: 'args', takesValue: true },
  '--schema': { key: 'schema', takesValue: false },
  '--help': { key: 'help', takesValue: false },
  '-h': { key: 'help', takesValue: false },
  // Compatibility spellings (ADR 0005, decision 11).
  '--tool': { key: 'tool', takesValue: true },
  '-t': { key: 'tool', takesValue: true },
  '--verbose': { key: 'verbose', takesValue: false },
  '-v': { key: 'verbose', takesValue: false },
};

export type DomainInvocation = {
  /** Leading tokens that are not flags: the domain, then the tool or a legacy verb. */
  positionals: string[];
  cli: DomainCliOptions;
  /** Every other token, in order, for {@link parseToolFlags}. */
  toolTokens: string[];
};

const isFlagToken = (token: string): boolean => token.length > 1 && token.startsWith('-');

const splitInlineValue = (token: string): { name: string; inline?: string } => {
  const index = token.indexOf('=');
  if (!token.startsWith('--') || index === -1) {
    return { name: token };
  }
  return { name: token.slice(0, index), inline: token.slice(index + 1) };
};

/** First pass: positionals and CLI-owned flags. Tool flags are set aside. */
export const parseDomainInvocation = (tokens: readonly string[]): DomainInvocation => {
  const positionals: string[] = [];
  const cli: DomainCliOptions = {};
  const toolTokens: string[] = [];
  let index = 0;

  while (index < tokens.length && !isFlagToken(tokens[index]!)) {
    positionals.push(tokens[index]!);
    index += 1;
  }

  while (index < tokens.length) {
    const token = tokens[index]!;
    index += 1;

    if (token === '--') {
      toolTokens.push(...tokens.slice(index));
      break;
    }

    const { name, inline } = isFlagToken(token) ? splitInlineValue(token) : { name: token };
    const spec = isFlagToken(token) ? DOMAIN_CLI_FLAGS[name] : undefined;
    if (!spec) {
      toolTokens.push(token);
      continue;
    }

    if (!spec.takesValue) {
      (cli as Record<string, unknown>)[spec.key] = true;
      continue;
    }

    const value = inline ?? tokens[index];
    if (inline === undefined) {
      index += 1;
    }
    if (value === undefined) {
      throw new Error(`${name} requires a value.`);
    }
    (cli as Record<string, unknown>)[spec.key] = value;
  }

  return { positionals, cli, toolTokens };
};

/** Throws for tokens left over on a command that takes no tool flags. */
export const assertNoToolTokens = (toolTokens: readonly string[], usage: string): void => {
  const first = toolTokens[0];
  if (first === undefined) {
    return;
  }

  if (isFlagToken(first)) {
    throw new Error(`Unknown option "${splitInlineValue(first).name}". Usage: ${usage}`);
  }
  throw new Error(`Unexpected argument "${first}". Usage: ${usage}`);
};

type FlagKind = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'json';

const KIND_BY_TYPEOF: Record<string, FlagKind> = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
};

const getSchemaType = (schema: JSONSchema7 | undefined): string | undefined => {
  if (!schema) {
    return undefined;
  }
  if (Array.isArray(schema.type)) {
    return schema.type.find((type) => type !== 'null');
  }
  return schema.type;
};

/** How a property is written on the command line. */
export const getFlagKind = (schema: JSONSchema7 | undefined): FlagKind => {
  const type = getSchemaType(schema);
  switch (type) {
    case 'string':
    case 'number':
    case 'integer':
    case 'boolean':
    case 'array':
      return type;
    case undefined: {
      const sample = schema?.enum?.[0] ?? schema?.const;
      if (sample !== undefined && KIND_BY_TYPEOF[typeof sample]) {
        return KIND_BY_TYPEOF[typeof sample]!;
      }
      return schema?.items ? 'array' : 'json';
    }
    default:
      return 'json';
  }
};

const getItemSchema = (schema: JSONSchema7): JSONSchema7 | undefined =>
  Array.isArray(schema.items) ? schema.items[0] : schema.items;

export type ToolFlagSchema = {
  /** The tool name to print in errors and help. */
  toolLabel: string;
  inputSchema: JSONSchema7 | undefined;
};

const getProperties = (inputSchema: JSONSchema7 | undefined): Record<string, JSONSchema7> =>
  inputSchema && typeof inputSchema.properties === 'object' && inputSchema.properties !== null
    ? inputSchema.properties
    : {};

/** The arguments of a tool that can be written as flags, in schema order. */
export const getDerivedFlagNames = (inputSchema: JSONSchema7 | undefined): string[] =>
  Object.keys(getProperties(inputSchema)).filter((name) => !NON_DERIVABLE_FLAGS.has(name));

const foldFlagName = (value: string): string => value.toLowerCase().replace(/[-_]/g, '');

const findProperty = (flagName: string, derivable: readonly string[]): string | undefined => {
  if (derivable.includes(flagName)) {
    return flagName;
  }
  const folded = foldFlagName(flagName);
  const matches = derivable.filter((name) => foldFlagName(name) === folded);
  return matches.length === 1 ? matches[0] : undefined;
};

const describeArguments = (derivable: readonly string[]): string =>
  derivable.length > 0
    ? `Its arguments: ${derivable.map((name) => `--${name}`).join(', ')}.`
    : 'It takes no arguments as flags.';

const parseNumber = (flag: string, raw: string, integer: boolean): number => {
  const value = Number(raw);
  if (raw.trim() === '' || !Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    throw new Error(`--${flag} expects ${integer ? 'an integer' : 'a number'}, got "${raw}".`);
  }
  return value;
};

const parseBoolean = (flag: string, raw: string): boolean => {
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  throw new Error(`--${flag} expects true or false, got "${raw}".`);
};

const parseJsonValue = (flag: string, raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`--${flag} expects JSON, got "${raw}".`);
  }
};

const parseScalar = (flag: string, raw: string, schema: JSONSchema7 | undefined): unknown => {
  const kind = getFlagKind(schema);
  switch (kind) {
    case 'number':
    case 'integer':
      return parseNumber(flag, raw, kind === 'integer');
    case 'boolean':
      return parseBoolean(flag, raw);
    case 'string':
      return raw;
    default: {
      // An untyped argument takes JSON when it is JSON, else the text as typed.
      if (getSchemaType(schema) === undefined) {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      }
      return parseJsonValue(flag, raw);
    }
  }
};

const parseArrayValue = (flag: string, raw: string, schema: JSONSchema7): unknown[] => {
  const itemSchema = getItemSchema(schema);
  if (raw.trimStart().startsWith('[')) {
    const parsed = parseJsonValue(flag, raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`--${flag} expects a JSON array or comma-separated values.`);
    }
    return parsed;
  }

  if (getFlagKind(itemSchema) === 'json') {
    return [parseJsonValue(flag, raw)];
  }

  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => parseScalar(flag, part, itemSchema));
};

/**
 * Second pass: reads the tokens set aside by {@link parseDomainInvocation}
 * against the tool's schema.
 *
 * - `string`, `number`, `integer`, `boolean`: one value (`--noHost` alone
 *   means `true`, and takes an explicit `true`/`false` after it);
 * - `array`: repeat the flag or separate values with commas;
 * - `object` and anything else: a JSON string.
 *
 * A flag the schema does not declare fails with the tool's argument names.
 */
export const parseToolFlags = (
  tokens: readonly string[],
  tool: ToolFlagSchema,
): Record<string, unknown> => {
  const properties = getProperties(tool.inputSchema);
  const derivable = getDerivedFlagNames(tool.inputSchema);
  const args: Record<string, unknown> = {};
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index]!;
    index += 1;

    if (!isFlagToken(token)) {
      throw new Error(
        `Unexpected argument "${token}" for tool "${tool.toolLabel}". Arguments are passed as --<name> <value>. ${describeArguments(derivable)}`,
      );
    }

    const { name: rawName, inline } = splitInlineValue(token);
    const flagName = rawName.replace(/^--?/, '');
    const property = findProperty(flagName, derivable);
    if (!property) {
      throw new Error(
        `Unknown option "${rawName}" for tool "${tool.toolLabel}". ${describeArguments(derivable)} Pass anything else with --args '<json>'.`,
      );
    }

    const schema = properties[property]!;
    const kind = getFlagKind(schema);

    if (kind === 'boolean' && inline === undefined) {
      const next = tokens[index];
      if (next === 'true' || next === 'false') {
        index += 1;
        args[property] = next === 'true';
      } else {
        args[property] = true;
      }
      continue;
    }

    const raw = inline ?? tokens[index];
    if (inline === undefined) {
      index += 1;
    }
    if (raw === undefined) {
      throw new Error(`--${property} requires a value.`);
    }

    if (kind === 'array') {
      const existing = Array.isArray(args[property]) ? (args[property] as unknown[]) : [];
      args[property] = [...existing, ...parseArrayValue(property, raw, schema)];
      continue;
    }

    args[property] = parseScalar(property, raw, schema);
  }

  return args;
};

export const parseArgsJson = (rawArgs: string | undefined): unknown => {
  if (rawArgs === undefined) {
    return {};
  }

  try {
    return JSON.parse(rawArgs);
  } catch {
    throw new Error('--args must be valid JSON');
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Builds the arguments a tool is called with: `--args` first, then the
 * derived flags, then `--limit`/`--cursor` for a tool that takes them.
 * Explicit flags win over `--args`.
 */
export const buildToolArguments = (input: {
  argsJson: unknown;
  flagArgs: Record<string, unknown>;
  limit?: string;
  cursor?: string;
  /** Whether the tool takes `limit`/`cursor` (it pages, or declares them). */
  acceptsPaging: { limit: boolean; cursor: boolean };
  toolLabel: string;
  requireObject: boolean;
}): unknown => {
  const paging: Record<string, unknown> = {};
  if (input.limit !== undefined) {
    if (!input.acceptsPaging.limit) {
      throw new Error(
        `Tool "${input.toolLabel}" does not page its results; --limit does not apply.`,
      );
    }
    paging.limit = parseLimit(input.limit);
  }
  if (input.cursor !== undefined) {
    if (!input.acceptsPaging.cursor) {
      throw new Error(
        `Tool "${input.toolLabel}" does not page its results; --cursor does not apply.`,
      );
    }
    paging.cursor = input.cursor;
  }

  const hasOverrides = Object.keys(input.flagArgs).length > 0 || Object.keys(paging).length > 0;
  if (!isRecord(input.argsJson)) {
    if (hasOverrides || input.requireObject) {
      throw new Error('--args must be a JSON object');
    }
    // A tool with no flags keeps receiving exactly what `--args` said.
    return input.argsJson;
  }

  return { ...input.argsJson, ...input.flagArgs, ...paging };
};

const isPrimitive = (value: unknown): value is string | number | boolean =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

const matchesKind = (value: unknown, kind: FlagKind): boolean => {
  switch (kind) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    default:
      return value !== undefined;
  }
};

const renderFlag = (name: string, value: unknown, schema: JSONSchema7 | undefined): string[] => {
  const kind = getFlagKind(schema);
  switch (kind) {
    case 'boolean':
      return value === true ? [`--${name}`] : [`--${name}`, 'false'];
    case 'string':
    case 'number':
    case 'integer':
      return [`--${name}`, String(value)];
    case 'array': {
      const values = value as unknown[];
      const commaSeparated =
        getFlagKind(getItemSchema(schema!)) !== 'json' &&
        values.length > 0 &&
        values.every(
          (item) =>
            isPrimitive(item) &&
            String(item) !== '' &&
            String(item).trim() === String(item) &&
            !String(item).includes(',') &&
            !String(item).startsWith('['),
        );
      return [`--${name}`, commaSeparated ? values.join(',') : JSON.stringify(values)];
    }
    default:
      // An untyped argument given text that is not JSON reads back as text.
      return [
        `--${name}`,
        typeof value === 'string' && getSchemaType(schema) === undefined
          ? value
          : JSON.stringify(value),
      ];
  }
};

/**
 * Renders tool arguments back into flags for a `next` command, so the
 * command reads the way a person would have typed it. An argument goes
 * into a trailing `--args` instead when it has no flag (an undeclared
 * argument, or one named like a CLI-owned flag) or when its value would
 * not survive the round trip through its flag.
 *
 * `limit` becomes `--limit`; `cursor` is left to the caller.
 */
export const renderToolArguments = (
  args: Record<string, unknown>,
  inputSchema: JSONSchema7 | undefined,
): string[] => {
  const properties = getProperties(inputSchema);
  const derivable = new Set(getDerivedFlagNames(inputSchema));
  const rendered: string[] = [];
  const leftover: Record<string, unknown> = {};

  for (const [name, value] of Object.entries(args)) {
    if (name === 'cursor' || value === undefined) {
      continue;
    }
    if (name === 'limit' && typeof value === 'number') {
      rendered.push('--limit', String(value));
      continue;
    }

    const schema = properties[name];
    const kind = getFlagKind(schema);
    const untypedString =
      kind === 'json' && getSchemaType(schema) === undefined && typeof value === 'string';
    const roundTrips =
      derivable.has(name) &&
      matchesKind(value, kind) &&
      // An untyped argument reads JSON first, so text that parses as JSON
      // would come back as something else.
      !(untypedString && isJsonText(value));
    if (!roundTrips || (kind === 'array' && !arrayItemsRoundTrip(value as unknown[], schema!))) {
      leftover[name] = value;
      continue;
    }

    rendered.push(...renderFlag(name, value, schema));
  }

  if (Object.keys(leftover).length > 0) {
    rendered.push('--args', JSON.stringify(leftover));
  }

  return rendered;
};

const isJsonText = (value: string): boolean => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

const arrayItemsRoundTrip = (values: unknown[], schema: JSONSchema7): boolean => {
  const itemKind = getFlagKind(getItemSchema(schema));
  return values.every((item) => itemKind === 'json' || matchesKind(item, itemKind));
};

const formatPlaceholder = (schema: JSONSchema7): string => {
  const kind = getFlagKind(schema);
  if (kind === 'boolean') {
    return '';
  }
  if (kind === 'array') {
    const itemKind = getFlagKind(getItemSchema(schema));
    return itemKind === 'json' ? ' <json>' : ` <${itemKind},...>`;
  }
  return kind === 'json' ? ' <json>' : ` <${kind}>`;
};

const formatAllowedValues = (schema: JSONSchema7): string => {
  const source = Array.isArray(schema.enum) ? schema.enum : getItemSchema(schema)?.enum;
  return Array.isArray(source) && source.length > 0
    ? ` One of: ${source.map((value) => String(value)).join(', ')}.`
    : '';
};

const formatRows = (rows: Array<[string, string]>): string[] => {
  const width = Math.min(Math.max(...rows.map(([left]) => left.length)) + 2, 34);
  return rows.map(([left, right]) =>
    right ? `  ${left.padEnd(width)}${right}`.trimEnd() : `  ${left}`,
  );
};

/**
 * `rozenite agent <domain> <tool> --help`, generated from the schema the
 * CLI already fetched to parse the tool's flags.
 */
export const formatToolHelp = (input: {
  domain: string;
  tool: string;
  description?: string;
  inputSchema: JSONSchema7 | undefined;
  fields?: { fields: readonly string[]; defaultFields?: readonly string[] };
  paged: boolean;
}): string => {
  const properties = getProperties(input.inputSchema);
  const required = new Set(
    Array.isArray(input.inputSchema?.required) ? input.inputSchema.required : [],
  );
  const derivable = getDerivedFlagNames(input.inputSchema);
  const viaArgs = Object.keys(properties).filter(
    (name) =>
      !derivable.includes(name) && !(input.paged && (name === 'limit' || name === 'cursor')),
  );

  const lines = [`Usage: rozenite agent ${input.domain} ${input.tool} [options]`, ''];
  if (input.description) {
    lines.push(input.description, '');
  }

  if (derivable.length > 0) {
    lines.push('Arguments:');
    lines.push(
      ...formatRows(
        derivable.map((name) => {
          const schema = properties[name]!;
          const notes = [
            schema.description ?? '',
            formatAllowedValues(schema).trim(),
            required.has(name) ? '(required)' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return [`--${name}${formatPlaceholder(schema)}`, notes];
        }),
      ),
    );
    lines.push('');
  }

  if (viaArgs.length > 0) {
    lines.push(`Through --args only: ${viaArgs.join(', ')}`, '');
  }

  const options: Array<[string, string]> = [];
  if (input.paged || 'limit' in properties) {
    options.push(['--limit <n>', 'Page size']);
  }
  if (input.paged || 'cursor' in properties) {
    options.push(['--cursor <token>', 'Continue from a previous page']);
  }
  if (input.fields) {
    const defaults = input.fields.defaultFields ?? input.fields.fields;
    options.push([
      '--fields <csv|all>',
      `Columns to print: ${input.fields.fields.join(', ')} (default: ${defaults.join(', ')})`,
    ]);
  }
  options.push(
    ['--args <json>', 'Arguments as a JSON object; flags win over it'],
    ['--schema', "Print the tool's input schema"],
    ['--session <id>', 'Use this session instead of resolving one'],
    ['--device <id>', 'Resolve the session for this device'],
    ['--pretty', 'Indent JSON output'],
  );

  lines.push('Options:', ...formatRows(options));
  return `${lines.join('\n')}\n`;
};
