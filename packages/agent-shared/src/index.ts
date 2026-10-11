import type { RozeniteHostIntegration, RozeniteIntegration } from '@rozenite/tools/integration';
import type { UnsupportedDomainInfo } from './capabilities.js';
import { AGENT_MESSAGE_TYPES } from './message-types.js';

export {
  createEmptyCapabilityProfile,
  DEFAULT_AGENT_TARGET_INTEGRATION,
  getUnsupportedDomains,
  getUnsupportedToolReason,
  isToolSupported,
} from './capabilities.js';
export type {
  CapabilityProfile,
  DomainCapability,
  ToolAvailability,
  ToolCapability,
  UnsupportedDomainInfo,
  UnsupportedToolInfo,
} from './capabilities.js';

export {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  parseFields,
  parseLimit,
  projectRows,
  shapePaginatedRows,
  shapeToolResult,
} from './output-shaping.js';

export { decodeCursor, encodeCursor, normalizePageLimit, paginateArray } from './pagination.js';
export type { CursorKey, CursorPayload, PaginateArrayOptions } from './pagination.js';

export { getErrorDetails } from './errors.js';
export { AGENT_MESSAGE_TYPES } from './message-types.js';
export {
  BUILT_IN_DOMAIN_TOOL_NAMES,
  CONSOLE_TOOL_NAMES,
  MEMORY_TOOL_NAMES,
  NETWORK_TOOL_NAMES,
  PERFORMANCE_TOOL_NAMES,
  REACT_TOOL_NAMES,
} from './built-in-tools.js';
export { parseAgentTargetsResponse } from './targets-response.js';
export type { ParsedTargetsResponse } from './targets-response.js';

export const AGENT_PLUGIN_ID = 'rozenite-agent';

export const DEFAULT_AGENT_HOST = '127.0.0.1';
export const DEFAULT_AGENT_PORT = 8081;

export const AGENT_ROUTE_BASE = '/rozenite/agent';
export const AGENT_INFO_ROUTE = `${AGENT_ROUTE_BASE}/info`;
export const AGENT_TARGETS_ROUTE = `${AGENT_ROUTE_BASE}/targets`;
export const AGENT_SESSIONS_ROUTE = `${AGENT_ROUTE_BASE}/sessions`;
export const AGENT_SESSION_ROUTE_PATTERN = `${AGENT_SESSIONS_ROUTE}/:sessionId`;
export const AGENT_SESSION_TOOLS_ROUTE_PATTERN = `${AGENT_SESSION_ROUTE_PATTERN}/tools`;
export const AGENT_SESSION_CALL_TOOL_ROUTE_PATTERN = `${AGENT_SESSION_ROUTE_PATTERN}/call-tool`;
export const AGENT_SESSION_TAP_ROUTE_PATTERN = `${AGENT_SESSION_ROUTE_PATTERN}/tap`;

export const getAgentSessionRoute = (sessionId: string): string => {
  return `${AGENT_SESSIONS_ROUTE}/${encodeURIComponent(sessionId)}`;
};

export const getAgentSessionToolsRoute = (sessionId: string): string => {
  return `${getAgentSessionRoute(sessionId)}/tools`;
};

export const getAgentSessionCallToolRoute = (sessionId: string): string => {
  return `${getAgentSessionRoute(sessionId)}/call-tool`;
};

export const getAgentSessionTapRoute = (sessionId: string): string => {
  return `${getAgentSessionRoute(sessionId)}/tap`;
};

export interface JSONSchema7 {
  type?: string | string[];
  properties?: Record<string, JSONSchema7>;
  items?: JSONSchema7 | JSONSchema7[];
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  description?: string;
  title?: string;
  default?: unknown;
  examples?: unknown[];
  [key: string]: unknown;
}

export interface PageEnvelope {
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
  reset?: boolean;
}

export interface PageResult<TItem, TMeta = unknown> {
  items: TItem[];
  page: PageEnvelope;
  meta?: TMeta;
}

export interface AgentToolPagination {
  kind: 'cursor';
  /** Every row field an agent may request. */
  fields: readonly string[];
  /** The projection used when the caller does not ask for fields. */
  defaultFields?: readonly string[];
  /** Result key holding the rows, when it is not `items`. */
  itemsKey?: string;
  /**
   * Top-level result keys, besides the rows and `page`, that a frontend
   * prints with a page. Omitted means "print every key"; `[]` means "print
   * only the rows and the page". The result itself is never changed.
   */
  meta?: readonly string[];
}

/** Row metadata for a tool that returns a list without paging it. */
export interface AgentToolRows {
  /** Result key holding the rows. Defaults to `items`. */
  key?: string;
  /** Every row field an agent may request. */
  fields: readonly string[];
  /** The projection used when the caller does not ask for fields. */
  defaultFields?: readonly string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isUniqueNonEmptyStringList = (value: unknown): value is string[] =>
  isStringArray(value) &&
  value.every((item) => item.length > 0) &&
  new Set(value).size === value.length;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const hasValidFieldSet = (fields: unknown, defaultFields: unknown): boolean => {
  if (!isStringArray(fields) || fields.length === 0 || new Set(fields).size !== fields.length) {
    return false;
  }

  if (defaultFields === undefined) {
    return true;
  }

  if (
    !isStringArray(defaultFields) ||
    defaultFields.length === 0 ||
    new Set(defaultFields).size !== defaultFields.length
  ) {
    return false;
  }

  const allowedFields = new Set(fields);
  return defaultFields.every((field) => allowedFields.has(field));
};

export const isAgentToolPagination = (value: unknown): value is AgentToolPagination => {
  if (!isRecord(value) || value.kind !== 'cursor') {
    return false;
  }

  if (value.itemsKey !== undefined && !isNonEmptyString(value.itemsKey)) {
    return false;
  }

  if (value.meta !== undefined && !isUniqueNonEmptyStringList(value.meta)) {
    return false;
  }

  return hasValidFieldSet(value.fields, value.defaultFields);
};

export const isAgentToolRows = (value: unknown): value is AgentToolRows => {
  if (!isRecord(value)) {
    return false;
  }

  if (value.key !== undefined && !isNonEmptyString(value.key)) {
    return false;
  }

  return hasValidFieldSet(value.fields, value.defaultFields);
};

export interface AgentToolTraits {
  /** Whether this tool leaves app, device, and external state unchanged. */
  readOnly?: boolean;
  /** Whether this tool can delete, reset, overwrite, or cause meaningful loss. */
  destructive?: boolean;
  /** Whether repeating an identical call produces the same final effect. */
  idempotent?: boolean;
}

export interface AgentTool extends AgentToolTraits {
  name: string;
  description: string;
  inputSchema: JSONSchema7;
  pagination?: AgentToolPagination;
  /** Declares the rows of a list this tool returns without paging it. */
  rows?: AgentToolRows;
}

type AgentToolTypeCarrier<TArgs = unknown, TResult = unknown> = {
  /**
   * Keep these phantom fields string-keyed so separately emitted .d.ts files
   * remain structurally compatible across packages.
   */
  readonly __rozeniteAgentToolArgs__?: TArgs;
  readonly __rozeniteAgentToolResult__?: TResult;
};

export interface AgentToolContract<TArgs = unknown, TResult = unknown>
  extends AgentTool, AgentToolTypeCarrier<TArgs, TResult> {}

type AgentToolDescriptorShape = AgentToolTraits & {
  domain: string;
  name: string;
  description: string;
  inputSchema: JSONSchema7;
  pagination?: AgentToolPagination;
  rows?: AgentToolRows;
};

export interface AgentToolDescriptor<TArgs = unknown, TResult = unknown>
  extends AgentToolDescriptorShape, AgentToolTypeCarrier<TArgs, TResult> {}

export type InferAgentToolArgs<TTool> =
  TTool extends AgentToolTypeCarrier<infer TArgs, unknown> ? TArgs : unknown;

export type InferAgentToolResult<TTool> =
  TTool extends AgentToolTypeCarrier<unknown, infer TResult> ? TResult : unknown;

export const defineAgentToolContract = <TArgs, TResult>(
  tool: AgentTool,
): AgentToolContract<TArgs, TResult> => {
  return tool as AgentToolContract<TArgs, TResult>;
};

type ListRow = Record<string, unknown>;

type PaginatedResultShape<TItemsKey extends string> = { page: PageEnvelope } & {
  [K in TItemsKey]: readonly ListRow[];
};

type RowsResultShape<TKey extends string> = { [K in TKey]: readonly ListRow[] };

type ListRowOf<TResult, TKey extends string> = TResult extends {
  [K in TKey]: readonly (infer TRow)[];
}
  ? TRow
  : never;

type ListRowField<TResult, TKey extends string> = Extract<keyof ListRowOf<TResult, TKey>, string>;

/** `items` may be spelled out or left out; any other key must be declared. */
type ListKeyDeclaration<TName extends string, TKey extends string> = 'items' extends TKey
  ? { [K in TName]?: TKey }
  : { [K in TName]: TKey };

type PaginatedToolShape<TResult, TItemsKey extends string> = AgentTool & {
  pagination: Omit<AgentToolPagination, 'fields' | 'defaultFields' | 'itemsKey' | 'meta'> &
    ListKeyDeclaration<'itemsKey', TItemsKey> & {
      fields: readonly ListRowField<TResult, TItemsKey>[];
      defaultFields?: readonly ListRowField<TResult, TItemsKey>[];
      meta?: readonly Extract<Exclude<keyof TResult, TItemsKey | 'page'>, string>[];
    };
};

type RowsToolShape<TResult, TKey extends string> = AgentTool & {
  rows: ListKeyDeclaration<'key', TKey> & {
    fields: readonly ListRowField<TResult, TKey>[];
    defaultFields?: readonly ListRowField<TResult, TKey>[];
  };
};

/**
 * Defines a cursor-paginated tool. `fields`, `defaultFields` and `meta` are
 * checked against `TResult` at compile time. Rows live under `items` unless
 * the third type argument names another key, which must then be passed as
 * `pagination.itemsKey`.
 */
export const definePaginatedAgentToolContract = <
  TArgs,
  TResult extends PaginatedResultShape<TItemsKey>,
  TItemsKey extends string = 'items',
>(
  tool: PaginatedToolShape<TResult, TItemsKey>,
): AgentToolContract<TArgs, TResult> => {
  if (!isAgentToolPagination(tool.pagination)) {
    throw new Error(
      'Paginated agent tool fields must be non-empty, unique, and contain every default field; itemsKey must be a non-empty string; meta must list unique non-empty keys',
    );
  }

  return tool as AgentToolContract<TArgs, TResult>;
};

/**
 * Defines a tool that returns a list without paging it. `rows.fields` and
 * `rows.defaultFields` are checked against the row type at compile time.
 * Rows live under `items` unless the third type argument names another key,
 * which must then be passed as `rows.key`.
 */
export const defineRowsAgentToolContract = <
  TArgs,
  TResult extends RowsResultShape<TKey>,
  TKey extends string = 'items',
>(
  tool: RowsToolShape<TResult, TKey>,
): AgentToolContract<TArgs, TResult> => {
  if (!isAgentToolRows(tool.rows)) {
    throw new Error(
      'Agent tool rows must declare non-empty, unique fields that contain every default field, and a non-empty key',
    );
  }

  return tool as AgentToolContract<TArgs, TResult>;
};

export const defineAgentToolDescriptor = <TArgs, TResult>(
  descriptor: AgentToolDescriptorShape,
): AgentToolDescriptor<TArgs, TResult> => {
  return descriptor as AgentToolDescriptor<TArgs, TResult>;
};

export const defineAgentToolDescriptors = <
  TTools extends Record<string, AgentToolContract<unknown, unknown>>,
>(
  domain: string,
  tools: TTools,
): {
  [K in keyof TTools]: AgentToolDescriptor<
    InferAgentToolArgs<TTools[K]>,
    InferAgentToolResult<TTools[K]>
  >;
} => {
  return Object.fromEntries(
    Object.entries(tools).map(([key, tool]) => [
      key,
      defineAgentToolDescriptor({
        domain,
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        ...(tool.readOnly !== undefined ? { readOnly: tool.readOnly } : {}),
        ...(tool.destructive !== undefined ? { destructive: tool.destructive } : {}),
        ...(tool.idempotent !== undefined ? { idempotent: tool.idempotent } : {}),
        ...(tool.pagination ? { pagination: tool.pagination } : {}),
        ...(tool.rows ? { rows: tool.rows } : {}),
      }),
    ]),
  ) as {
    [K in keyof TTools]: AgentToolDescriptor<
      InferAgentToolArgs<TTools[K]>,
      InferAgentToolResult<TTools[K]>
    >;
  };
};

export type AgentSessionStatus = 'connecting' | 'connected' | 'stopped';

export type AgentSessionHealingOutcome = {
  outcome: 'recovered' | 'failed' | 'blocked';
  message: string;
  at: number;
};

export type MetroTarget = {
  /**
   * Unique id for this target, which is one *page* (one debuggable
   * runtime), not one device. A device can host several: Lynx apps open a
   * card per screen, and a React Native app gains a page per extra VM (a
   * Reanimated worklet runtime, for instance). Each is separately
   * connectable, so each gets its own target and its own id.
   */
  id: string;
  /**
   * The device the page belongs to (Metro's `logicalDeviceId`). Several
   * targets share one of these whenever a device hosts more than one
   * page, which is why it cannot be `id`.
   */
  deviceId: string;
  name: string;
  appId: string;
  /**
   * The page's id within its own device -- the `page` query parameter of
   * `webSocketDebuggerUrl` -- not a globally unique id. That is `id`,
   * above, which is the `<deviceId>-<pageId>` composite.
   */
  pageId: string;
  title: string;
  description: string;
  webSocketDebuggerUrl: string;
  /**
   * Which integration serves this target, set from the middleware's own
   * `RozeniteConfig.integration`. Consumers must read it from here rather
   * than guess it from a port: a `--port` a user chose says nothing about
   * which integration listens on it.
   */
  integration: RozeniteHostIntegration;
};

export type AgentServerInfo = {
  host: string;
  port: number;
  projectRoot: string;
  sessionCount: number;
};

export type AgentSessionInfo = {
  id: string;
  host: string;
  port: number;
  deviceId: string;
  deviceName: string;
  appId: string;
  pageId: string;
  status: AgentSessionStatus;
  /**
   * The integration this session resolved a capability profile from.
   * Optional so a newer CLI can read an older server's session info,
   * which simply does not carry it.
   */
  integration?: RozeniteIntegration;
  createdAt: number;
  lastActivityAt: number;
  connectedAt?: number;
  lastError?: string;
  healing?: AgentSessionHealingOutcome;
  toolCount: number;
};

export type AgentErrorInfo = {
  message: string;
};

export type AgentSuccessEnvelope<TResult> = {
  ok: true;
  result: TResult;
};

export type AgentErrorEnvelope = {
  ok: false;
  error: AgentErrorInfo;
};

export type AgentResponseEnvelope<TResult> = AgentSuccessEnvelope<TResult> | AgentErrorEnvelope;

export type GetAgentInfoResponse = {
  info: AgentServerInfo;
};

export type GetAgentTargetsResponse = {
  targets: MetroTarget[];
};

export type CreateAgentSessionRequest = {
  deviceId?: string;
  cliVersion?: string;
};

export type CreateAgentSessionResponse = {
  session: AgentSessionInfo;
  versionCheck?: string;
};

export type ListAgentSessionsResponse = {
  sessions: AgentSessionInfo[];
};

export type GetAgentSessionResponse = {
  session: AgentSessionInfo;
};

export type DeleteAgentSessionResponse = {
  stopped: boolean;
};

export type GetAgentSessionToolsResponse = {
  tools: AgentTool[];
  /**
   * Both fields are optional on purpose. An older CLI against a newer
   * server ignores them; a newer CLI against an older server reads
   * `undefined` and falls back to treating every domain as supported,
   * which is exactly the pre-capability behaviour. No lockstep upgrade.
   */
  integration?: RozeniteIntegration;
  unsupported?: UnsupportedDomainInfo[];
};

export type CallAgentSessionToolRequest = {
  toolName: string;
  args: unknown;
};

export type CallAgentSessionToolResponse = {
  result: unknown;
};

export type DevToolsPluginMessage = {
  pluginId: string;
  type: string;
  payload: unknown;
};

/** Direction of a tapped message relative to this machine: `in` was received
 * from the device, `out` was sent to it. */
export type TapDirection = 'in' | 'out';

export type TapEvent = {
  direction: TapDirection;
  timestamp: number;
  pluginId: string;
  type: string;
  payload: unknown;
};

export type SendAgentSessionTapMessageRequest = {
  pluginId: string;
  type: string;
  payload: unknown;
};

export type SendAgentSessionTapMessageResponse = {
  sent: true;
};

export type RegisterToolPayload = {
  tools: AgentTool[];
};

export type UnregisterToolPayload = {
  toolNames: string[];
};

export type ToolCallPayload = {
  callId: string;
  toolName: string;
  arguments: unknown;
};

export type ToolResultPayload = {
  callId: string;
  success: boolean;
  result?: unknown;
  error?: string;
};

export type AgentSessionReadyPayload = {
  sessionId?: string;
};

export type RegisterToolMessage = {
  type: typeof AGENT_MESSAGE_TYPES.registerTool;
  payload: RegisterToolPayload;
};

export type UnregisterToolMessage = {
  type: typeof AGENT_MESSAGE_TYPES.unregisterTool;
  payload: UnregisterToolPayload;
};

export type ToolCallMessage = {
  type: typeof AGENT_MESSAGE_TYPES.toolCall;
  payload: ToolCallPayload;
};

export type ToolResultMessage = {
  type: typeof AGENT_MESSAGE_TYPES.toolResult;
  payload: ToolResultPayload;
};

export type AgentSessionReadyMessage = {
  type: typeof AGENT_MESSAGE_TYPES.agentSessionReady;
  payload: AgentSessionReadyPayload;
};

export type AgentMessage =
  | RegisterToolMessage
  | UnregisterToolMessage
  | ToolCallMessage
  | ToolResultMessage
  | AgentSessionReadyMessage;

/** Payload type for each agent message `type`, as a device-bridge event map. */
export type AgentEventMap = {
  [AGENT_MESSAGE_TYPES.agentSessionReady]: AgentSessionReadyPayload;
  [AGENT_MESSAGE_TYPES.registerTool]: RegisterToolPayload;
  [AGENT_MESSAGE_TYPES.unregisterTool]: UnregisterToolPayload;
  [AGENT_MESSAGE_TYPES.toolCall]: ToolCallPayload;
  [AGENT_MESSAGE_TYPES.toolResult]: ToolResultPayload;
};
