import type {
  AgentSessionInfo,
  AgentTool,
  AgentToolPagination,
  AgentToolDescriptor,
  CallAgentSessionToolRequest,
  CallAgentSessionToolResponse,
  CreateAgentSessionRequest,
  CreateAgentSessionResponse,
  DeleteAgentSessionResponse,
  GetAgentInfoResponse,
  GetAgentSessionResponse,
  GetAgentSessionToolsResponse,
  GetAgentTargetsResponse,
  InferAgentToolArgs,
  InferAgentToolResult,
  JSONSchema7,
  ListAgentSessionsResponse,
  MetroTarget,
} from '@rozenite/agent-shared';

export interface DomainDefinition {
  id: string;
  kind: 'static' | 'plugin';
  description: string;
  pluginId?: string;
  slug?: string;
  actions: Array<'list-tools' | 'get-tool-schema' | 'call-tool'>;
}

export interface AgentDomainTool extends AgentTool {
  shortName: string;
  /** Canonical domain id the requested domain token resolved to. */
  domainId: string;
}

export interface AgentToolSchema {
  name: string;
  shortName: string;
  inputSchema: JSONSchema7;
  pagination?: AgentToolPagination;
}

export interface AgentClientOptions {
  host?: string;
  port?: number;
}

export interface AgentDynamicToolCallInput<TArgs = unknown> {
  domain: string;
  tool: string;
  args?: TArgs;
}

type AgentDescriptorCallTuple<
  TDescriptor extends AgentToolDescriptor<unknown, unknown>,
> = [InferAgentToolArgs<TDescriptor>] extends [undefined]
  ? [args?: InferAgentToolArgs<TDescriptor>]
  : Record<string, never> extends InferAgentToolArgs<TDescriptor>
    ? [args?: InferAgentToolArgs<TDescriptor>]
    : [args: InferAgentToolArgs<TDescriptor>];

export interface AgentSessionDomains {
  list: () => Promise<DomainDefinition[]>;
}

export interface AgentResolvedTool<TArgs = unknown, TResult = unknown> {
  /** Canonical domain id the requested domain token resolved to. */
  domainId: string;
  schema: AgentToolSchema;
  call: (args?: TArgs) => Promise<TResult>;
}

export interface AgentSessionTools {
  list: (input: { domain: string }) => Promise<AgentDomainTool[]>;
  getSchema: (input: {
    domain: string;
    tool: string;
  }) => Promise<AgentToolSchema>;
  /**
   * Resolves a domain token and tool name to its schema and a bound `call`
   * once, so callers that need both the schema (e.g. to inspect pagination
   * metadata) and the ability to invoke the tool don't pay for a second
   * `getSessionTools` round trip.
   */
  resolve: <TArgs = unknown, TResult = unknown>(input: {
    domain: string;
    tool: string;
  }) => Promise<AgentResolvedTool<TArgs, TResult>>;
  call: {
    <TArgs = unknown, TResult = unknown>(
      input: AgentDynamicToolCallInput<TArgs>,
    ): Promise<TResult>;
    <TDescriptor extends AgentToolDescriptor<unknown, unknown>>(
      descriptor: TDescriptor,
      ...args: AgentDescriptorCallTuple<TDescriptor>
    ): Promise<InferAgentToolResult<TDescriptor>>;
  };
}

export interface AgentSessionClient {
  id: string;
  info: AgentSessionInfo;
  stop: () => Promise<DeleteAgentSessionResponse>;
  domains: AgentSessionDomains;
  tools: AgentSessionTools;
}

export type AgentSessionCallback<T> = (
  session: AgentSessionClient,
) => Promise<T> | T;

export interface AgentTransport {
  host: string;
  port: number;
  getInfo: () => Promise<GetAgentInfoResponse>;
  listTargets: () => Promise<GetAgentTargetsResponse>;
  createSession: (
    body: CreateAgentSessionRequest,
  ) => Promise<CreateAgentSessionResponse>;
  listSessions: () => Promise<ListAgentSessionsResponse>;
  getSession: (sessionId: string) => Promise<GetAgentSessionResponse>;
  stopSession: (sessionId: string) => Promise<DeleteAgentSessionResponse>;
  getSessionTools: (sessionId: string) => Promise<GetAgentSessionToolsResponse>;
  callSessionTool: (
    sessionId: string,
    body: CallAgentSessionToolRequest,
  ) => Promise<CallAgentSessionToolResponse>;
}

export interface AgentClient {
  targets: {
    list: () => Promise<MetroTarget[]>;
  };
  withSession: {
    <T>(callback: AgentSessionCallback<T>): Promise<T>;
    <T>(
      input: CreateAgentSessionRequest,
      callback: AgentSessionCallback<T>,
    ): Promise<T>;
  };
  openSession: (
    input?: CreateAgentSessionRequest,
  ) => Promise<AgentSessionClient>;
  attachSession: (sessionId: string) => Promise<AgentSessionClient>;
}
