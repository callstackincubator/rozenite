import { request as httpRequest } from 'node:http';
import type { MCPTool } from './types.js';

interface MCPDevice {
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

export type HttpMCPClient = ReturnType<typeof createHttpMCPClient>;

export const createHttpMCPClient = (host: string, port: number) => {
  const createConnectionHint = (reason: string): Error => {
    return new Error(
      `${reason}. Ensure Metro is running, Rozenite middleware is enabled with enableMCP=true, and /rozenite-mcp/v1 is available on http://${host}:${port}.`,
    );
  };

  const requestJson = async <T>(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    timeoutMs: number,
  ): Promise<T> => {
    const bodyJson = body ? JSON.stringify(body) : undefined;
    const url = new URL(`http://${host}:${port}/rozenite-mcp/v1${path}`);

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
          || `MCP request failed (${response.statusCode} ${response.statusMessage})`;
        throw new Error(message);
      }

      return (parsed ?? {}) as T;
    } catch (error) {
      if (error instanceof Error && error.message === 'timeout') {
        throw createConnectionHint('MCP request timed out');
      }

      if (error instanceof Error) {
        throw createConnectionHint(`Failed MCP HTTP request (${error.message})`);
      }

      throw createConnectionHint('Failed MCP HTTP request');
    }
  };

  const connect = async (): Promise<void> => {
    await requestJson<unknown>('GET', '/devices', undefined, DEVICES_TIMEOUT_MS);
  };

  const getTools = async (deviceId?: string): Promise<MCPTool[]> => {
    const query = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : '';
    const response = await requestJson<{ tools?: MCPTool[] }>(
      'GET',
      `/tools${query}`,
      undefined,
      TOOLS_TIMEOUT_MS,
    );
    return response.tools ?? [];
  };

  const getDevices = async (): Promise<MCPDevice[]> => {
    const response = await requestJson<{ devices?: MCPDevice[] }>(
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
