import {
  DEFAULT_AGENT_HOST,
  DEFAULT_AGENT_PORT,
  DEFAULT_AGENT_TARGET_INTEGRATION,
  type AgentServerInfo,
  type AgentSessionInfo,
  type CreateAgentSessionRequest,
  type DevToolsPluginMessage,
  type GetAgentSessionToolsResponse,
} from '@rozenite/agent-shared';
import type { RozeniteIntegration } from '@rozenite/tools/integration';
import { getMetroTargets, resolveMetroTarget } from './metro-discovery.js';
import { createAgentSession, type AgentSession } from './session.js';
import type { TapListener } from './tap.js';

export type AgentSessionManager = ReturnType<typeof createAgentSessionManager>;

export const createAgentSessionManager = (options: {
  projectRoot: string;
  host?: string;
  port?: number;
  metroVersion?: string;
  /** The integration this dev server hosts. See `RozeniteConfig.integration`. */
  integration?: RozeniteIntegration;
}) => {
  const metroVersion = options.metroVersion;
  const integration = options.integration ?? DEFAULT_AGENT_TARGET_INTEGRATION;
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
  ): Promise<{
    session: AgentSessionInfo;
    versionCheck?: string;
  }> => {
    const versionCheck =
      request.cliVersion && metroVersion && request.cliVersion !== metroVersion
        ? `Connected Rozenite agent uses version ${request.cliVersion}, but Metro is running version ${metroVersion}. Integration may not work correctly.`
        : undefined;
    const target = await resolveMetroTarget(currentHost, currentPort, request.deviceId);
    const existing = sessions.get(target.id);
    if (existing) {
      if (existing.isReusable(target)) {
        return {
          session: existing.getInfo(),
          versionCheck,
        };
      }

      // A logical device id survives most reloads, while Metro gives the app a
      // new page id. Never hand a caller a session pinned to that old page.
      sessions.delete(target.id);
      await existing.stop();
    }

    const session = createAgentSession({
      projectRoot: options.projectRoot,
      host: currentHost,
      port: currentPort,
      target,
      integration,
      cliVersion: request.cliVersion,
      metroVersion,
      resolveTarget: (deviceId) => resolveMetroTarget(currentHost, currentPort, deviceId),
      onTerminated: (sessionId) => {
        const current = sessions.get(sessionId);
        if (
          current === session &&
          ['blocked', 'failed'].includes(session.getInfo().healing?.outcome ?? '')
        ) {
          // Keep terminal recovery information visible to `session show` and
          // `session list`; an explicit stop or a replacement target removes it.
          return;
        }
        if (current === session) {
          sessions.delete(sessionId);
        }
      },
    });

    try {
      await session.start();
      sessions.set(target.id, session);
      return {
        session: session.getInfo(),
        versionCheck,
      };
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
      .sort((a, b) => a.deviceName.localeCompare(b.deviceName) || a.id.localeCompare(b.id));
  };

  const getSession = (sessionId: string): AgentSessionInfo => {
    return getSessionOrThrow(sessionId).getInfo();
  };

  const stopSession = async (sessionId: string): Promise<{ stopped: boolean }> => {
    const session = getSessionOrThrow(sessionId);
    sessions.delete(sessionId);
    await session.stop();
    return { stopped: true };
  };

  const getSessionTools = (sessionId: string): GetAgentSessionToolsResponse => {
    const session = getSessionOrThrow(sessionId);

    return {
      tools: session.getTools(),
      integration: session.getIntegration(),
      unsupported: session.getUnsupportedDomains(),
    };
  };

  const callSessionTool = async (
    sessionId: string,
    toolName: string,
    args: unknown,
  ): Promise<unknown> => {
    return await getSessionOrThrow(sessionId).callTool(toolName, args);
  };

  const subscribeSessionTap = (sessionId: string, listener: TapListener): (() => void) => {
    return getSessionOrThrow(sessionId).subscribeTap(listener);
  };

  const sendSessionTapMessage = async (
    sessionId: string,
    message: DevToolsPluginMessage,
  ): Promise<void> => {
    await getSessionOrThrow(sessionId).sendTapMessage(message);
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
    subscribeSessionTap,
    sendSessionTapMessage,
    dispose,
  };
};
