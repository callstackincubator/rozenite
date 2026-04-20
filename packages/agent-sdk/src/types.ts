import type {
  AgentSessionInfo,
  AgentTool,
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
}

export interface AgentToolSchema {
  name: string;
  shortName: string;
  inputSchema: JSONSchema7;
}

export interface AgentClientOptions {
  host?: string;
  port?: number;
}

export interface AgentCallToolAutoPaginationOptions {
  pagesLimit?: number;
  maxItems?: number;
}

export interface AgentDynamicToolCallInput<TArgs = unknown> {
  domain: string;
  tool: string;
  args?: TArgs;
  autoPaginate?: AgentCallToolAutoPaginationOptions;
}

export interface AgentToolCallOptions {
  autoPaginate?: AgentCallToolAutoPaginationOptions;
}

type AgentDescriptorCallTuple<
  TDescriptor extends AgentToolDescriptor<unknown, unknown>,
> =
  [InferAgentToolArgs<TDescriptor>] extends [undefined]
    ? [args?: InferAgentToolArgs<TDescriptor>, options?: AgentToolCallOptions]
    : {} extends InferAgentToolArgs<TDescriptor>
      ? [args?: InferAgentToolArgs<TDescriptor>, options?: AgentToolCallOptions]
      : [args: InferAgentToolArgs<TDescriptor>, options?: AgentToolCallOptions];

export interface AgentSessionDomains {
  list: () => Promise<DomainDefinition[]>;
}

export interface AgentSessionTools {
  list: (input: { domain: string }) => Promise<AgentDomainTool[]>;
  getSchema: (input: {
    domain: string;
    tool: string;
  }) => Promise<AgentToolSchema>;
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
  getSessionTools: (
    sessionId: string,
  ) => Promise<GetAgentSessionToolsResponse>;
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
  openSession: (input?: CreateAgentSessionRequest) => Promise<AgentSessionClient>;
  attachSession: (sessionId: string) => Promise<AgentSessionClient>;
}
