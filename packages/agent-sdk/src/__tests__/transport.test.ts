import {
  AGENT_SESSIONS_ROUTE,
  AGENT_TARGETS_ROUTE,
  DEFAULT_AGENT_HOST,
  DEFAULT_AGENT_PORT,
  getAgentSessionCallToolRoute,
  getAgentSessionRoute,
  getAgentSessionToolsRoute,
} from '@rozenite/agent-shared';
import { describe, expect, it } from 'vitest';
import {
  httpTestHarness,
  mockUnknownRoute,
  type MockHttpRequest,
  type MockHttpResult,
} from './http-test-harness.js';
import { createAgentTransport } from '../transport.js';

describe('agent transport', () => {
  it('uses the shared default host and port when no options are provided', () => {
    const transport = createAgentTransport();

    expect(transport.host).toBe(DEFAULT_AGENT_HOST);
    expect(transport.port).toBe(DEFAULT_AGENT_PORT);
  });

  it('uses the provided host and port overrides', () => {
    const transport = createAgentTransport({
      host: '10.0.0.5',
      port: 9090,
    });

    expect(transport.host).toBe('10.0.0.5');
    expect(transport.port).toBe(9090);
  });

  it('calls the expected transport routes and unwraps JSON envelopes', async () => {
    const requests: Array<{
      method: string;
      pathname: string;
      body: unknown;
    }> = [];

    httpTestHarness.requestHandler.mockImplementation(
      async ({
        method,
        pathname,
        body,
      }: MockHttpRequest): Promise<MockHttpResult> => {
        requests.push({ method, pathname, body });

        if (method === 'GET' && pathname === AGENT_TARGETS_ROUTE) {
          return {
            payload: {
              ok: true,
              result: { targets: [{ id: 'device-1', name: 'Phone' }] },
            },
          };
        }

        if (method === 'POST' && pathname === AGENT_SESSIONS_ROUTE) {
          return {
            payload: {
              ok: true,
              result: { session: { id: 'session-1', deviceId: 'device-1' } },
            },
          };
        }

        if (method === 'GET' && pathname === getAgentSessionRoute('session-1')) {
          return {
            payload: {
              ok: true,
              result: { session: { id: 'session-1', deviceId: 'device-1' } },
            },
          };
        }

        if (
          method === 'DELETE' &&
          pathname === getAgentSessionRoute('session-1')
        ) {
          return {
            payload: {
              ok: true,
              result: { stopped: true },
            },
          };
        }

        if (
          method === 'GET' &&
          pathname === getAgentSessionToolsRoute('session-1')
        ) {
          return {
            payload: {
              ok: true,
              result: {
                tools: [
                  {
                    name: 'app.echo',
                    description: 'Echo',
                    inputSchema: { type: 'object' },
                  },
                ],
              },
            },
          };
        }

        if (
          method === 'POST' &&
          pathname === getAgentSessionCallToolRoute('session-1')
        ) {
          return {
            payload: {
              ok: true,
              result: { result: { value: 'hello' } },
            },
          };
        }

        return mockUnknownRoute();
      },
    );

    const transport = createAgentTransport({
      host: '127.0.0.1',
      port: 8081,
    });

    await expect(transport.listTargets()).resolves.toEqual({
      targets: [{ id: 'device-1', name: 'Phone' }],
    });
    await expect(transport.createSession({ deviceId: 'device-1' })).resolves.toEqual({
      session: { id: 'session-1', deviceId: 'device-1' },
    });
    await expect(transport.getSession('session-1')).resolves.toEqual({
      session: { id: 'session-1', deviceId: 'device-1' },
    });
    await expect(transport.stopSession('session-1')).resolves.toEqual({
      stopped: true,
    });
    await expect(transport.getSessionTools('session-1')).resolves.toEqual({
      tools: [
        {
          name: 'app.echo',
          description: 'Echo',
          inputSchema: { type: 'object' },
        },
      ],
    });
    await expect(
      transport.callSessionTool('session-1', {
        toolName: 'app.echo',
        args: { value: 'hello' },
      }),
    ).resolves.toEqual({
      result: { value: 'hello' },
    });

    expect(requests).toEqual([
      { method: 'GET', pathname: AGENT_TARGETS_ROUTE, body: undefined },
      {
        method: 'POST',
        pathname: AGENT_SESSIONS_ROUTE,
        body: { deviceId: 'device-1' },
      },
      {
        method: 'GET',
        pathname: getAgentSessionRoute('session-1'),
        body: undefined,
      },
      {
        method: 'DELETE',
        pathname: getAgentSessionRoute('session-1'),
        body: undefined,
      },
      {
        method: 'GET',
        pathname: getAgentSessionToolsRoute('session-1'),
        body: undefined,
      },
      {
        method: 'POST',
        pathname: getAgentSessionCallToolRoute('session-1'),
        body: { toolName: 'app.echo', args: { value: 'hello' } },
      },
    ]);
  });

  it('preserves API validation errors from the server', async () => {
    httpTestHarness.requestHandler.mockResolvedValue({
      statusCode: 400,
      payload: {
        ok: false,
        error: { message: 'Multiple Metro targets detected. Pass --deviceId.' },
      },
    });

    const transport = createAgentTransport({
      host: '127.0.0.1',
      port: 8081,
    });

    await expect(transport.createSession({})).rejects.toThrow(
      'Multiple Metro targets detected. Pass --deviceId.',
    );
  });

  it('wraps connection failures with the Metro reachability message', async () => {
    httpTestHarness.requestHandler.mockResolvedValue({
      error: new Error('connect ECONNREFUSED 127.0.0.1:1'),
    });

    const transport = createAgentTransport({
      host: '127.0.0.1',
      port: 1,
    });

    await expect(transport.listTargets()).rejects.toThrow(
      'Unable to reach Metro at http://127.0.0.1:1. Make sure Metro is running and reachable, then try again. Details: connect ECONNREFUSED 127.0.0.1:1',
    );
  });
});
