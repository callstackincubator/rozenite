import {
  DEFAULT_AGENT_HOST,
  DEFAULT_AGENT_PORT,
  type AgentServerInfo,
  type AgentSessionInfo,
  type AgentTool,
  type CreateAgentSessionRequest,
} from '@rozenite/agent-shared';
import { getMetroTargets, resolveMetroTarget } from './metro-discovery.js';
import { createAgentSession, type AgentSession } from './session.js';

export type AgentSessionManager = ReturnType<typeof createAgentSessionManager>;

export const createAgentSessionManager = (options: {
  projectRoot: string;
  host?: string;
  port?: number;
}) => {
  const sessions = new Map<string, AgentSession>();
  let currentHost = options.host ?? DEFAULT_AGENT_HOST;
  let currentPort = options.port ?? DEFAULT_AGENT_PORT;

  const syncEndpoint = (host: string, port: number): void => {
    currentHost = host;
    currentPort = port;
  };

  const getInfo = (): AgentServerInfo => {
    return {
      host: currentHost,
      port: currentPort,
      projectRoot: options.projectRoot,
      sessionCount: sessions.size,
    };
  };

  const listTargets = async () => {
    return await getMetroTargets(currentHost, currentPort);
  };

  const getSessionOrThrow = (sessionId: string): AgentSession => {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown session "${sessionId}"`);
    }
    return session;
  };

  const createSession = async (
    request: CreateAgentSessionRequest = {},
  ): Promise<AgentSessionInfo> => {
    const target = await resolveMetroTarget(
      currentHost,
      currentPort,
      request.deviceId,
    );
    const existing = sessions.get(target.id);
    if (existing) {
      return existing.getInfo();
    }

    const session = createAgentSession({
      projectRoot: options.projectRoot,
      host: currentHost,
      port: currentPort,
      target,
      onTerminated: (sessionId) => {
        const current = sessions.get(sessionId);
        if (current === session) {
          sessions.delete(sessionId);
        }
      },
    });

    try {
      await session.start();
      sessions.set(target.id, session);
      return session.getInfo();
    } catch (error) {
      sessions.delete(target.id);
      try {
        await session.stop();
      } catch {
        // Ignore teardown errors after failed startup.
      }
      throw error;
    }
  };

  const listSessions = (): AgentSessionInfo[] => {
    return Array.from(sessions.values())
      .map((session) => session.getInfo())
      .sort(
        (a, b) =>
          a.deviceName.localeCompare(b.deviceName) || a.id.localeCompare(b.id),
      );
  };

  const getSession = (sessionId: string): AgentSessionInfo => {
    return getSessionOrThrow(sessionId).getInfo();
  };

  const stopSession = async (
    sessionId: string,
  ): Promise<{ stopped: boolean }> => {
    const session = getSessionOrThrow(sessionId);
    sessions.delete(sessionId);
    await session.stop();
    return { stopped: true };
  };

  const getSessionTools = (sessionId: string): AgentTool[] => {
    return getSessionOrThrow(sessionId).getTools();
  };

  const callSessionTool = async (
    sessionId: string,
    toolName: string,
    args: unknown,
  ): Promise<unknown> => {
    return await getSessionOrThrow(sessionId).callTool(toolName, args);
  };

  const dispose = async (): Promise<void> => {
    const activeSessions = Array.from(sessions.values());
    sessions.clear();
    await Promise.all(activeSessions.map((session) => session.stop()));
  };

  return {
    syncEndpoint,
    getInfo,
    listTargets,
    createSession,
    listSessions,
    getSession,
    stopSession,
    getSessionTools,
    callSessionTool,
    dispose,
  };
};
