import type { MCPTool } from './types.js';

export type SessionStatus = 'connecting' | 'connected' | 'disconnected' | 'stopped';

export type SessionInfo = {
  id: string;
  host: string;
  port: number;
  deviceId: string;
  deviceName: string;
  appId: string;
  pageId: string;
  status: SessionStatus;
  createdAt: number;
  lastActivityAt: number;
  connectedAt?: number;
  lastError?: string;
  toolCount: number;
};

export type DaemonInfo = {
  pid: number;
  workspace: string;
  socketPath: string;
  startedAt: number;
  sessionCount: number;
};

export type MetroTarget = {
  id: string;
  name: string;
  appId: string;
  pageId: string;
  title: string;
  description: string;
  webSocketDebuggerUrl: string;
};

export type RPCMethod =
  | 'daemon.health'
  | 'daemon.shutdown'
  | 'metro.targets'
  | 'session.create'
  | 'session.list'
  | 'session.show'
  | 'session.stop'
  | 'session.tools'
  | 'session.call-tool';

export type RPCRequestMap = {
  'daemon.health': undefined;
  'daemon.shutdown': undefined;
  'metro.targets': {
    host: string;
    port: number;
  };
  'session.create': {
    host: string;
    port: number;
    deviceId?: string;
  };
  'session.list': undefined;
  'session.show': {
    sessionId: string;
  };
  'session.stop': {
    sessionId: string;
  };
  'session.tools': {
    sessionId: string;
  };
  'session.call-tool': {
    sessionId: string;
    toolName: string;
    args: unknown;
  };
};

export type RPCResponseMap = {
  'daemon.health': DaemonInfo;
  'daemon.shutdown': {
    stopped: boolean;
    stoppedSessions: number;
  };
  'metro.targets': {
    targets: MetroTarget[];
  };
  'session.create': {
    session: SessionInfo;
  };
  'session.list': {
    sessions: SessionInfo[];
  };
  'session.show': {
    session: SessionInfo;
  };
  'session.stop': {
    stopped: boolean;
  };
  'session.tools': {
    tools: MCPTool[];
  };
  'session.call-tool': {
    result: unknown;
  };
};

export type RPCRequestEnvelope<TMethod extends RPCMethod = RPCMethod> = {
  id: string;
  method: TMethod;
  params: RPCRequestMap[TMethod];
};

export type RPCSuccessEnvelope<TMethod extends RPCMethod = RPCMethod> = {
  id: string;
  ok: true;
  result: RPCResponseMap[TMethod];
};

export type RPCErrorEnvelope = {
  id: string;
  ok: false;
  error: {
    message: string;
  };
};

export type RPCResponseEnvelope<TMethod extends RPCMethod = RPCMethod> =
  | RPCSuccessEnvelope<TMethod>
  | RPCErrorEnvelope;
