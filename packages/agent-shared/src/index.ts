import type { RozeniteHostIntegration, RozeniteIntegration } from '@rozenite/tools/integration';
import type { UnsupportedDomainInfo } from './capabilities.js';

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
  fields: readonly string[];
  defaultFields?: readonly string[];
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export const isAgentToolPagination = (value: unknown): value is AgentToolPagination => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const pagination = value as Record<string, unknown>;
  if (
    pagination.kind !== 'cursor' ||
    !isStringArray(pagination.fields) ||
    pagination.fields.length === 0 ||
    new Set(pagination.fields).size !== pagination.fields.length
  ) {
    return false;
  }

  if (pagination.defaultFields === undefined) {
    return true;
  }

  if (
    !isStringArray(pagination.defaultFields) ||
    pagination.defaultFields.length === 0 ||
    new Set(pagination.defaultFields).size !== pagination.defaultFields.length
  ) {
    return false;
  }

  const allowedFields = new Set(pagination.fields);
  return pagination.defaultFields.every((field) => allowedFields.has(field));
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

type PaginatedResultShape<TItem> = {
  items: TItem[];
  page: PageEnvelope;
};

type PaginatedItem<TResult> = TResult extends PaginatedResultShape<infer TItem> ? TItem : never;

type PaginatedItemField<TResult> = Extract<keyof PaginatedItem<TResult>, string>;

type PaginatedToolShape<TResult> = AgentTool & {
  pagination: Omit<AgentToolPagination, 'fields' | 'defaultFields'> & {
    fields: readonly PaginatedItemField<TResult>[];
    defaultFields?: readonly PaginatedItemField<TResult>[];
  };
};

export const definePaginatedAgentToolContract = <
  TArgs,
  TResult extends PaginatedResultShape<Record<string, unknown>>,
>(
  tool: PaginatedToolShape<TResult>,
): AgentToolContract<TArgs, TResult> => {
  if (!isAgentToolPagination(tool.pagination)) {
    throw new Error(
      'Paginated agent tool fields must be non-empty, unique, and contain every default field',
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
  type: 'register-tool';
  payload: RegisterToolPayload;
};

export type UnregisterToolMessage = {
  type: 'unregister-tool';
  payload: UnregisterToolPayload;
};

export type ToolCallMessage = {
  type: 'tool-call';
  payload: ToolCallPayload;
};

export type ToolResultMessage = {
  type: 'tool-result';
  payload: ToolResultPayload;
};

export type AgentSessionReadyMessage = {
  type: 'agent-session-ready';
  payload: AgentSessionReadyPayload;
};

export type AgentMessage =
  | RegisterToolMessage
  | UnregisterToolMessage
  | ToolCallMessage
  | ToolResultMessage
  | AgentSessionReadyMessage;
