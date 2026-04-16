export const AGENT_PLUGIN_ID = 'rozenite-agent';

export const DEFAULT_AGENT_HOST = 'localhost';
export const DEFAULT_AGENT_PORT = 8081;

export const AGENT_ROUTE_BASE = '/rozenite/agent';
export const AGENT_INFO_ROUTE = `${AGENT_ROUTE_BASE}/info`;
export const AGENT_TARGETS_ROUTE = `${AGENT_ROUTE_BASE}/targets`;
export const AGENT_SESSIONS_ROUTE = `${AGENT_ROUTE_BASE}/sessions`;
export const AGENT_SESSION_ROUTE_PATTERN = `${AGENT_SESSIONS_ROUTE}/:sessionId`;
export const AGENT_SESSION_TOOLS_ROUTE_PATTERN = `${AGENT_SESSION_ROUTE_PATTERN}/tools`;
export const AGENT_SESSION_CALL_TOOL_ROUTE_PATTERN = `${AGENT_SESSION_ROUTE_PATTERN}/call-tool`;

export const getAgentSessionRoute = (sessionId: string): string => {
  return `${AGENT_SESSIONS_ROUTE}/${encodeURIComponent(sessionId)}`;
};

export const getAgentSessionToolsRoute = (sessionId: string): string => {
  return `${getAgentSessionRoute(sessionId)}/tools`;
};

export const getAgentSessionCallToolRoute = (sessionId: string): string => {
  return `${getAgentSessionRoute(sessionId)}/call-tool`;
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

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: JSONSchema7;
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
  extends AgentTool,
    AgentToolTypeCarrier<TArgs, TResult> {}

type AgentToolDescriptorShape = {
  domain: string;
  name: string;
  description: string;
  inputSchema: JSONSchema7;
};

export interface AgentToolDescriptor<TArgs = unknown, TResult = unknown>
  extends AgentToolDescriptorShape,
    AgentToolTypeCarrier<TArgs, TResult> {}

export type InferAgentToolArgs<TTool> =
  TTool extends AgentToolTypeCarrier<infer TArgs, unknown> ? TArgs : unknown;

export type InferAgentToolResult<TTool> =
  TTool extends AgentToolTypeCarrier<unknown, infer TResult>
    ? TResult
    : unknown;

export const defineAgentToolContract = <TArgs, TResult>(
  tool: AgentTool,
): AgentToolContract<TArgs, TResult> => {
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

export type MetroTarget = {
  id: string;
  name: string;
  appId: string;
  pageId: string;
  title: string;
  description: string;
  webSocketDebuggerUrl: string;
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
  createdAt: number;
  lastActivityAt: number;
  connectedAt?: number;
  lastError?: string;
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

export type AgentResponseEnvelope<TResult> =
  | AgentSuccessEnvelope<TResult>
  | AgentErrorEnvelope;

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
