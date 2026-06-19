import {
  AGENT_SESSIONS_ROUTE,
  AGENT_TARGETS_ROUTE,
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
import { createAgentClient } from '../index.js';

describe('agent client', () => {
  it('unwraps targets and exposes explicit session handles', async () => {
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
              result: {
                session: {
                  id: 'session-1',
                  deviceId: 'device-1',
                  deviceName: 'Phone',
                  status: 'connected',
                },
              },
            },
          };
        }

        if (method === 'GET' && pathname === getAgentSessionRoute('session-2')) {
          return {
            payload: {
              ok: true,
              result: {
                session: {
                  id: 'session-2',
                  deviceId: 'device-2',
                  deviceName: 'Tablet',
                  status: 'connected',
                },
              },
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
          method === 'DELETE' &&
          pathname === getAgentSessionRoute('session-2')
        ) {
          return {
            payload: {
              ok: true,
              result: { stopped: true },
            },
          };
        }

        return mockUnknownRoute();
      },
    );

    const client = createAgentClient({
      host: '127.0.0.1',
      port: 8081,
    });

    await expect(client.targets.list()).resolves.toEqual([
      { id: 'device-1', name: 'Phone' },
    ]);

    const openedSession = await client.openSession({ deviceId: 'device-1' });
    expect(openedSession.id).toBe('session-1');
    expect(openedSession.info).toEqual({
      id: 'session-1',
      deviceId: 'device-1',
      deviceName: 'Phone',
      status: 'connected',
    });
    await expect(openedSession.stop()).resolves.toEqual({ stopped: true });
    expect(openedSession.info.status).toBe('stopped');
    await expect(openedSession.stop()).resolves.toEqual({ stopped: true });

    const attachedSession = await client.attachSession('session-2');
    expect(attachedSession.info).toEqual({
      id: 'session-2',
      deviceId: 'device-2',
      deviceName: 'Tablet',
      status: 'connected',
    });
    await expect(attachedSession.stop()).resolves.toEqual({ stopped: true });

    expect(requests).toEqual([
      { method: 'GET', pathname: AGENT_TARGETS_ROUTE, body: undefined },
      {
        method: 'POST',
        pathname: AGENT_SESSIONS_ROUTE,
        body: { deviceId: 'device-1' },
      },
      {
        method: 'DELETE',
        pathname: getAgentSessionRoute('session-1'),
        body: undefined,
      },
      {
        method: 'GET',
        pathname: getAgentSessionRoute('session-2'),
        body: undefined,
      },
      {
        method: 'DELETE',
        pathname: getAgentSessionRoute('session-2'),
        body: undefined,
      },
    ]);
  });

  it('binds a scoped helper client through withSession and stops the session', async () => {
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

        if (method === 'POST' && pathname === AGENT_SESSIONS_ROUTE) {
          return {
            payload: {
              ok: true,
              result: {
                session: {
                  id: 'session-3',
                  deviceId: 'device-1',
                  deviceName: 'Phone',
                  status: 'connected',
                },
              },
            },
          };
        }

        if (
          method === 'GET' &&
          pathname === getAgentSessionToolsRoute('session-3')
        ) {
          return {
            payload: {
              ok: true,
              result: {
                tools: [
                  {
                    name: 'app.echo',
                    description: 'Echo payload',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        value: { type: 'string' },
                      },
                    },
                  },
                ],
              },
            },
          };
        }

        if (
          method === 'POST' &&
          pathname === getAgentSessionCallToolRoute('session-3')
        ) {
          return {
            payload: {
              ok: true,
              result: {
                result: {
                  echoed: (body as { args?: { value?: string } })?.args?.value,
                },
              },
            },
          };
        }

        if (
          method === 'DELETE' &&
          pathname === getAgentSessionRoute('session-3')
        ) {
          return {
            payload: {
              ok: true,
              result: { stopped: true },
            },
          };
        }

        return mockUnknownRoute();
      },
    );

    const client = createAgentClient();

    await expect(
      client.withSession(async (session) => {
        expect(session.id).toBe('session-3');
        expect(session.info).toEqual({
          id: 'session-3',
          deviceId: 'device-1',
          deviceName: 'Phone',
          status: 'connected',
        });

        await expect(session.domains.list()).resolves.toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: 'app',
              kind: 'plugin',
              pluginId: 'app',
            }),
            expect.objectContaining({
              id: 'console',
              kind: 'static',
            }),
          ]),
        );

        return await session.tools.call<
          { value: string },
          { echoed: string }
        >({
          domain: 'app',
          tool: 'echo',
          args: { value: 'hello from withSession' },
        });
      }),
    ).resolves.toEqual({
      echoed: 'hello from withSession',
    });

    expect(requests).toEqual([
      {
        method: 'POST',
        pathname: AGENT_SESSIONS_ROUTE,
        body: {},
      },
      {
        method: 'GET',
        pathname: getAgentSessionToolsRoute('session-3'),
        body: undefined,
      },
      {
        method: 'GET',
        pathname: getAgentSessionToolsRoute('session-3'),
        body: undefined,
      },
      {
        method: 'POST',
        pathname: getAgentSessionCallToolRoute('session-3'),
        body: {
          toolName: 'app.echo',
          args: { value: 'hello from withSession' },
        },
      },
      {
        method: 'DELETE',
        pathname: getAgentSessionRoute('session-3'),
        body: undefined,
      },
    ]);
  });

  it('stops the session when the withSession callback throws', async () => {
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

        if (method === 'POST' && pathname === AGENT_SESSIONS_ROUTE) {
          return {
            payload: {
              ok: true,
              result: {
                session: {
                  id: 'session-4',
                  deviceId: 'device-1',
                  deviceName: 'Phone',
                  status: 'connected',
                },
              },
            },
          };
        }

        if (
          method === 'DELETE' &&
          pathname === getAgentSessionRoute('session-4')
        ) {
          return {
            payload: {
              ok: true,
              result: { stopped: true },
            },
          };
        }

        return mockUnknownRoute();
      },
    );

    const client = createAgentClient();

    await expect(
      client.withSession(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(requests).toEqual([
      {
        method: 'POST',
        pathname: AGENT_SESSIONS_ROUTE,
        body: {},
      },
      {
        method: 'DELETE',
        pathname: getAgentSessionRoute('session-4'),
        body: undefined,
      },
    ]);
  });
});
