import { request as httpRequest } from 'node:http';
import type { AgentTool } from './types.js';

interface AgentDevice {
  id: string;
  name: string;
  reactNativeVersion?: string;
}

type ErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

const TOOLS_TIMEOUT_MS = 5000;
const DEVICES_TIMEOUT_MS = 5000;
const CALL_TIMEOUT_MS = 30000;

export type HttpAgentClient = ReturnType<typeof createHttpAgentClient>;

export const createHttpAgentClient = (host: string, port: number) => {
  const createConnectionHint = (reason: string): Error => {
    return new Error(
      `${reason}. Ensure Metro is running, Rozenite middleware is enabled with enableAgentTools=true, and /rozenite-agent/v1 is available on http://${host}:${port}.`,
    );
  };

  const requestJson = async <T>(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    timeoutMs: number,
  ): Promise<T> => {
    const bodyJson = body ? JSON.stringify(body) : undefined;
    const url = new URL(`http://${host}:${port}/rozenite-agent/v1${path}`);

    try {
      const response = await new Promise<{
        statusCode: number;
        statusMessage: string;
        body: string;
      }>((resolve, reject) => {
        const req = httpRequest(
          url,
          {
            method,
            headers: bodyJson
              ? {
                  'content-type': 'application/json',
                  'content-length': Buffer.byteLength(bodyJson).toString(),
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
              resolve({
                statusCode: res.statusCode ?? 0,
                statusMessage: res.statusMessage ?? '',
                body: data,
              });
            });
          },
        );

        req.setTimeout(timeoutMs, () => {
          req.destroy(new Error('timeout'));
        });

        req.on('error', (error) => {
          reject(error);
        });

        if (bodyJson) {
          req.write(bodyJson);
        }
        req.end();
      });

      let parsed: unknown = undefined;
      try {
        parsed = response.body ? JSON.parse(response.body) : undefined;
      } catch {
        parsed = undefined;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        const errorBody = (parsed ?? {}) as ErrorBody;
        const message = errorBody.error?.message
          || `Agent request failed (${response.statusCode} ${response.statusMessage})`;
        throw new Error(message);
      }

      return (parsed ?? {}) as T;
    } catch (error) {
      if (error instanceof Error && error.message === 'timeout') {
        throw createConnectionHint('Agent request timed out');
      }

      if (error instanceof Error) {
        throw createConnectionHint(`Failed Agent HTTP request (${error.message})`);
      }

      throw createConnectionHint('Failed Agent HTTP request');
    }
  };

  const connect = async (): Promise<void> => {
    await requestJson<unknown>('GET', '/devices', undefined, DEVICES_TIMEOUT_MS);
  };

  const getTools = async (deviceId?: string): Promise<AgentTool[]> => {
    const query = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : '';
    const response = await requestJson<{ tools?: AgentTool[] }>(
      'GET',
      `/tools${query}`,
      undefined,
      TOOLS_TIMEOUT_MS,
    );
    return response.tools ?? [];
  };

  const getDevices = async (): Promise<AgentDevice[]> => {
    const response = await requestJson<{ devices?: AgentDevice[] }>(
      'GET',
      '/devices',
      undefined,
      DEVICES_TIMEOUT_MS,
    );
    return response.devices ?? [];
  };

  const callTool = async (name: string, args: unknown): Promise<unknown> => {
    const response = await requestJson<{ result?: unknown }>(
      'POST',
      '/tool-call',
      {
        name,
        arguments: args,
      },
      CALL_TIMEOUT_MS,
    );
    return response.result;
  };

  const close = (): void => {};

  return {
    connect,
    getTools,
    getDevices,
    callTool,
    close,
  };
};
