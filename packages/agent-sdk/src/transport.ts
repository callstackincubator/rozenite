import { request as httpRequest } from 'node:http';
import {
  AGENT_INFO_ROUTE,
  AGENT_SESSIONS_ROUTE,
  AGENT_TARGETS_ROUTE,
  DEFAULT_AGENT_HOST,
  DEFAULT_AGENT_PORT,
  getAgentSessionCallToolRoute,
  getAgentSessionRoute,
  getAgentSessionToolsRoute,
  type AgentResponseEnvelope,
  type CallAgentSessionToolResponse,
  type CreateAgentSessionResponse,
  type DeleteAgentSessionResponse,
  type GetAgentInfoResponse,
  type GetAgentSessionResponse,
  type GetAgentSessionToolsResponse,
  type GetAgentTargetsResponse,
  type ListAgentSessionsResponse,
} from '@rozenite/agent-shared';
import type { AgentClientOptions, AgentTransport } from './types.js';

export type { AgentClientOptions, AgentTransport } from './types.js';

const getErrorDetails = (error: unknown): string | null => {
  if (!error) {
    return null;
  }

  if (error instanceof AggregateError && error.errors.length > 0) {
    return error.errors
      .map((entry) => (entry instanceof Error ? entry.message : String(entry)))
      .join('; ');
  }

  return error instanceof Error ? error.message : String(error);
};

const createMetroConnectionError = (
  host: string,
  port: number,
  error: unknown,
): Error => {
  const details = getErrorDetails(error);
  return new Error(
    `Unable to reach Metro at http://${host}:${port}. Make sure Metro is running and reachable, then try again.${details ? ` Details: ${details}` : ''}`,
  );
};

const requestJson = async <TResult>(input: {
  host: string;
  port: number;
  method: 'GET' | 'POST' | 'DELETE';
  pathname: string;
  body?: unknown;
}): Promise<TResult> => {
  const url = new URL(`http://${input.host}:${input.port}${input.pathname}`);
  const payload =
    input.body === undefined ? undefined : JSON.stringify(input.body);

  return await new Promise<TResult>((resolve, reject) => {
    const req = httpRequest(
      url,
      {
        method: input.method,
        headers: payload
          ? {
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(payload, 'utf8'),
            }
          : undefined,
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            if (data.length === 0) {
              if ((res.statusCode ?? 500) >= 400) {
                reject(
                  new Error(
                    `Agent request failed with status ${res.statusCode ?? 500}`,
                  ),
                );
                return;
              }

              reject(new Error('Agent response body was empty'));
              return;
            }

            const parsed = JSON.parse(data) as AgentResponseEnvelope<TResult>;
            if (!parsed.ok) {
              reject(new Error(parsed.error.message));
              return;
            }

            resolve(parsed.result);
          } catch (error) {
            if ((res.statusCode ?? 500) >= 400) {
              reject(
                new Error(
                  `Agent request failed with status ${res.statusCode ?? 500}: ${data}`,
                ),
              );
              return;
            }

            reject(error);
          }
        });
      },
    );

    req.once('error', (error) => {
      reject(createMetroConnectionError(input.host, input.port, error));
    });

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
};

export const createAgentTransport = (
  options?: AgentClientOptions,
): AgentTransport => {
  const host = options?.host ?? DEFAULT_AGENT_HOST;
  const port = options?.port ?? DEFAULT_AGENT_PORT;

  return {
    host,
    port,
    getInfo: async () => {
      return await requestJson<GetAgentInfoResponse>({
        host,
        port,
        method: 'GET',
        pathname: AGENT_INFO_ROUTE,
      });
    },
    listTargets: async () => {
      return await requestJson<GetAgentTargetsResponse>({
        host,
        port,
        method: 'GET',
        pathname: AGENT_TARGETS_ROUTE,
      });
    },
    createSession: async (body) => {
      return await requestJson<CreateAgentSessionResponse>({
        host,
        port,
        method: 'POST',
        pathname: AGENT_SESSIONS_ROUTE,
        body,
      });
    },
    listSessions: async () => {
      return await requestJson<ListAgentSessionsResponse>({
        host,
        port,
        method: 'GET',
        pathname: AGENT_SESSIONS_ROUTE,
      });
    },
    getSession: async (sessionId) => {
      return await requestJson<GetAgentSessionResponse>({
        host,
        port,
        method: 'GET',
        pathname: getAgentSessionRoute(sessionId),
      });
    },
    stopSession: async (sessionId) => {
      return await requestJson<DeleteAgentSessionResponse>({
        host,
        port,
        method: 'DELETE',
        pathname: getAgentSessionRoute(sessionId),
      });
    },
    getSessionTools: async (sessionId) => {
      return await requestJson<GetAgentSessionToolsResponse>({
        host,
        port,
        method: 'GET',
        pathname: getAgentSessionToolsRoute(sessionId),
      });
    },
    callSessionTool: async (sessionId, body) => {
      return await requestJson<CallAgentSessionToolResponse>({
        host,
        port,
        method: 'POST',
        pathname: getAgentSessionCallToolRoute(sessionId),
        body,
      });
    },
  };
};
