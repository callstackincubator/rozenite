import { request as httpRequest } from 'node:http';
import {
  AGENT_INFO_ROUTE,
  AGENT_SESSIONS_ROUTE,
  AGENT_TARGETS_ROUTE,
  DEFAULT_AGENT_HOST,
  DEFAULT_AGENT_PORT,
  getAgentSessionCallToolRoute,
  getAgentSessionRoute,
  getAgentSessionTapRoute,
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
  type SendAgentSessionTapMessageResponse,
  type TapEvent,
} from '@rozenite/agent-shared';
import type { AgentClientOptions, AgentTapStreamHandle, AgentTransport } from './types.js';

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

const createMetroConnectionError = (host: string, port: number, error: unknown): Error => {
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
  const payload = input.body === undefined ? undefined : JSON.stringify(input.body);

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
                reject(new Error(`Agent request failed with status ${res.statusCode ?? 500}`));
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
                new Error(`Agent request failed with status ${res.statusCode ?? 500}: ${data}`),
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

/**
 * Opens the tap route's chunked newline-delimited-JSON stream and parses it
 * line by line. This bypasses `requestJson` (built around a single buffered
 * JSON envelope) since the tap response never ends on its own — the caller
 * closes it, typically on Ctrl-C.
 */
const openTapStream = (input: {
  host: string;
  port: number;
  sessionId: string;
  pluginId?: string;
  type?: string;
  onOpen?: () => void;
  onEvent: (event: TapEvent) => void;
  onError: (error: Error) => void;
  onEnd: () => void;
}): AgentTapStreamHandle => {
  const url = new URL(
    `http://${input.host}:${input.port}${getAgentSessionTapRoute(input.sessionId)}`,
  );
  if (input.pluginId) {
    url.searchParams.set('pluginId', input.pluginId);
  }
  if (input.type) {
    url.searchParams.set('type', input.type);
  }

  const req = httpRequest(url, { method: 'GET' }, (res) => {
    res.setEncoding('utf8');

    if ((res.statusCode ?? 500) >= 400) {
      let errorBody = '';
      res.on('data', (chunk: string) => {
        errorBody += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(errorBody) as AgentResponseEnvelope<never>;
          input.onError(
            new Error(
              !parsed.ok
                ? parsed.error.message
                : `Tap request failed with status ${res.statusCode ?? 500}`,
            ),
          );
        } catch {
          input.onError(new Error(`Tap request failed with status ${res.statusCode ?? 500}`));
        }
      });
      return;
    }

    input.onOpen?.();

    let buffer = '';
    res.on('data', (chunk: string) => {
      buffer += chunk;
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf('\n');

        if (!line) {
          continue;
        }

        try {
          input.onEvent(JSON.parse(line) as TapEvent);
        } catch {
          // Ignore a malformed line rather than tearing down the stream.
        }
      }
    });
    res.on('end', () => {
      input.onEnd();
    });
  });

  req.once('error', (error) => {
    input.onError(createMetroConnectionError(input.host, input.port, error));
  });

  req.end();

  return {
    close: () => {
      req.destroy();
    },
  };
};

export const createAgentTransport = (options?: AgentClientOptions): AgentTransport => {
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
    openSessionTap: (sessionId, filter, handlers) => {
      return openTapStream({
        host,
        port,
        sessionId,
        pluginId: filter.pluginId,
        type: filter.type,
        onOpen: handlers.onOpen,
        onEvent: handlers.onEvent,
        onError: handlers.onError,
        onEnd: handlers.onEnd,
      });
    },
    sendSessionTapMessage: async (sessionId, body) => {
      return await requestJson<SendAgentSessionTapMessageResponse>({
        host,
        port,
        method: 'POST',
        pathname: getAgentSessionTapRoute(sessionId),
        body,
      });
    },
  };
};
