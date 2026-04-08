import express, { type Request, type Response, type Router } from 'express';
import {
  AGENT_INFO_ROUTE,
  AGENT_SESSION_CALL_TOOL_ROUTE_PATTERN,
  AGENT_SESSION_ROUTE_PATTERN,
  AGENT_SESSION_TOOLS_ROUTE_PATTERN,
  AGENT_SESSIONS_ROUTE,
  AGENT_TARGETS_ROUTE,
  type AgentResponseEnvelope,
  type CreateAgentSessionRequest,
  type GetAgentInfoResponse,
  type GetAgentSessionResponse,
  type GetAgentSessionToolsResponse,
  type GetAgentTargetsResponse,
  type ListAgentSessionsResponse,
  type CreateAgentSessionResponse,
  type DeleteAgentSessionResponse,
  type CallAgentSessionToolResponse,
} from '@rozenite/agent-shared';
import type { AgentSessionManager } from './session-manager.js';

const getRequestHost = (req: Request): string => {
  const hostHeader = req.headers.host;
  if (typeof hostHeader === 'string' && hostHeader.length > 0) {
    return hostHeader.split(':', 1)[0] || req.hostname || 'localhost';
  }

  return req.hostname || 'localhost';
};

const getRequestPort = (req: Request): number => {
  const hostHeader = req.headers.host;
  if (typeof hostHeader === 'string') {
    const pieces = hostHeader.split(':');
    const maybePort = Number(pieces[pieces.length - 1]);
    if (Number.isInteger(maybePort) && maybePort > 0) {
      return maybePort;
    }
  }

  return req.socket.localPort || 8081;
};

const syncEndpoint = (manager: AgentSessionManager, req: Request): void => {
  manager.syncEndpoint(getRequestHost(req), getRequestPort(req));
};

const sendResult = <TResult>(res: Response, result: TResult): void => {
  const payload: AgentResponseEnvelope<TResult> = {
    ok: true,
    result,
  };
  res.json(payload);
};

const sendError = (res: Response, error: unknown): void => {
  const status =
    error instanceof Error &&
    /Unknown session|Unknown deviceId/.test(error.message)
      ? 404
      : 400;
  const payload: AgentResponseEnvelope<never> = {
    ok: false,
    error: {
      message: error instanceof Error ? error.message : String(error),
    },
  };
  res.status(status).json(payload);
};

const getSessionId = (req: Request): string => {
  const sessionId = req.params.sessionId;
  if (!sessionId) {
    throw new Error('Missing sessionId route parameter');
  }
  return sessionId;
};

const getBodyRecord = (req: Request): Record<string, unknown> => {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    return req.body as Record<string, unknown>;
  }

  return {};
};

export const createAgentRoutes = (manager: AgentSessionManager): Router => {
  const router = express.Router();
  router.use(express.json());

  router.get(AGENT_INFO_ROUTE, (req, res) => {
    syncEndpoint(manager, req);
    try {
      sendResult<GetAgentInfoResponse>(res, { info: manager.getInfo() });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get(AGENT_TARGETS_ROUTE, async (req, res) => {
    syncEndpoint(manager, req);
    try {
      const targets = await manager.listTargets();
      sendResult<GetAgentTargetsResponse>(res, { targets });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post(AGENT_SESSIONS_ROUTE, async (req, res) => {
    syncEndpoint(manager, req);
    try {
      const body = getBodyRecord(req);
      const result = await manager.createSession({
        ...(typeof body.deviceId === 'string'
          ? { deviceId: body.deviceId }
          : {}),
        ...(typeof body.cliVersion === 'string'
          ? { cliVersion: body.cliVersion }
          : {}),
      } satisfies CreateAgentSessionRequest);
      sendResult<CreateAgentSessionResponse>(res, result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get(AGENT_SESSIONS_ROUTE, (req, res) => {
    syncEndpoint(manager, req);
    try {
      sendResult<ListAgentSessionsResponse>(res, {
        sessions: manager.listSessions(),
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get(AGENT_SESSION_ROUTE_PATTERN, (req, res) => {
    syncEndpoint(manager, req);
    try {
      sendResult<GetAgentSessionResponse>(res, {
        session: manager.getSession(getSessionId(req)),
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.delete(AGENT_SESSION_ROUTE_PATTERN, async (req, res) => {
    syncEndpoint(manager, req);
    try {
      const result = await manager.stopSession(getSessionId(req));
      sendResult<DeleteAgentSessionResponse>(res, result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get(AGENT_SESSION_TOOLS_ROUTE_PATTERN, (req, res) => {
    syncEndpoint(manager, req);
    try {
      sendResult<GetAgentSessionToolsResponse>(res, {
        tools: manager.getSessionTools(getSessionId(req)),
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post(AGENT_SESSION_CALL_TOOL_ROUTE_PATTERN, async (req, res) => {
    syncEndpoint(manager, req);
    try {
      const body = getBodyRecord(req);
      if (typeof body.toolName !== 'string' || body.toolName.length === 0) {
        throw new Error('"toolName" is required');
      }

      const result = await manager.callSessionTool(
        getSessionId(req),
        body.toolName,
        body.args,
      );
      sendResult<CallAgentSessionToolResponse>(res, {
        result,
      } satisfies CallAgentSessionToolResponse);
    } catch (error) {
      sendError(res, error);
    }
  });

  return router;
};
