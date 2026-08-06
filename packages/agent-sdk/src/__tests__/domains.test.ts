import {
  defineAgentToolDescriptor,
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

const attachSession = async () => {
  return await createAgentClient().attachSession('session-1');
};

const mockAttachedSessionRoute = (pathname: string): MockHttpResult | undefined => {
  if (pathname === getAgentSessionRoute('session-1')) {
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

  return undefined;
};

describe('agent session domain and tool helpers', () => {
  it('lists static and runtime domains with short, derived plugin domain names', async () => {
    httpTestHarness.requestHandler.mockImplementation(
      async ({ pathname }: MockHttpRequest): Promise<MockHttpResult> => {
        const sessionRoute = mockAttachedSessionRoute(pathname);
        if (sessionRoute) {
          return sessionRoute;
        }

        if (pathname === getAgentSessionToolsRoute('session-1')) {
          return {
            payload: {
              ok: true,
              result: {
                tools: [
                  {
                    name: 'getMessages',
                    description: 'Console messages',
                    inputSchema: { type: 'object' },
                  },
                  {
                    name: 'app.echo',
                    description: 'Echo',
                    inputSchema: { type: 'object' },
                  },
                  {
                    name: '@rozenite/mmkv-plugin.list-entries',
                    description: 'Official plugin',
                    inputSchema: { type: 'object' },
                  },
                  {
                    name: '@avasapp/rozenite-plugin-ably.list-channels',
                    description: 'Third-party scoped plugin',
                    inputSchema: { type: 'object' },
                  },
                ],
              },
            },
          };
        }

        return mockUnknownRoute();
      },
    );

    const session = await attachSession();
    const domains = await session.domains.list();

    expect(domains.find((domain) => domain.id === 'console')).toMatchObject({
      id: 'console',
      kind: 'static',
    });
    expect(domains.find((domain) => domain.pluginId === 'app')).toMatchObject({
      id: 'app',
      kind: 'plugin',
    });
    expect(domains.find((domain) => domain.pluginId === '@rozenite/mmkv-plugin')).toMatchObject({
      id: 'mmkv',
      kind: 'plugin',
    });
    expect(
      domains.find((domain) => domain.pluginId === '@avasapp/rozenite-plugin-ably'),
    ).toMatchObject({
      id: 'avasapp/ably',
      kind: 'plugin',
    });
  });

  it('rejects listing domains when two plugins would derive the same domain name', async () => {
    httpTestHarness.requestHandler.mockImplementation(
      async ({ pathname }: MockHttpRequest): Promise<MockHttpResult> => {
        const sessionRoute = mockAttachedSessionRoute(pathname);
        if (sessionRoute) {
          return sessionRoute;
        }

        if (pathname === getAgentSessionToolsRoute('session-1')) {
          return {
            payload: {
              ok: true,
              result: {
                tools: [
                  {
                    name: '@a/rozenite-plugin-x.list',
                    description: 'First plugin',
                    inputSchema: { type: 'object' },
                  },
                  {
                    name: '@a/x-plugin.list',
                    description: 'Second, same-author plugin',
                    inputSchema: { type: 'object' },
                  },
                ],
              },
            },
          };
        }

        return mockUnknownRoute();
      },
    );

    const session = await attachSession();

    await expect(session.domains.list()).rejects.toThrow(/Ambiguous domain name "a\/x"/);
  });

  it('resolves domains and tools by plugin id and short tool name', async () => {
    httpTestHarness.requestHandler.mockImplementation(
      async ({ pathname }: MockHttpRequest): Promise<MockHttpResult> => {
        const sessionRoute = mockAttachedSessionRoute(pathname);
        if (sessionRoute) {
          return sessionRoute;
        }

        if (pathname === getAgentSessionToolsRoute('session-1')) {
          return {
            payload: {
              ok: true,
              result: {
                tools: [
                  {
                    name: '@rozenite/mmkv-plugin.list-entries',
                    description: 'List entries',
                    inputSchema: {
                      type: 'object',
                      properties: { limit: { type: 'number' } },
                    },
                  },
                ],
              },
            },
          };
        }

        return mockUnknownRoute();
      },
    );

    const session = await attachSession();

    await expect(
      session.tools.list({
        domain: '@rozenite/mmkv-plugin',
      }),
    ).resolves.toEqual([
      {
        name: '@rozenite/mmkv-plugin.list-entries',
        shortName: 'list-entries',
        domainId: 'mmkv',
        description: 'List entries',
        inputSchema: {
          type: 'object',
          properties: { limit: { type: 'number' } },
        },
      },
    ]);

    await expect(
      session.tools.getSchema({
        domain: '@rozenite/mmkv-plugin',
        tool: 'list-entries',
      }),
    ).resolves.toEqual({
      name: '@rozenite/mmkv-plugin.list-entries',
      shortName: 'list-entries',
      inputSchema: {
        type: 'object',
        properties: { limit: { type: 'number' } },
      },
    });
  });

  it('throws the current ambiguous short-name error for domain tools', async () => {
    httpTestHarness.requestHandler.mockImplementation(
      async ({ pathname }: MockHttpRequest): Promise<MockHttpResult> => {
        const sessionRoute = mockAttachedSessionRoute(pathname);
        if (sessionRoute) {
          return sessionRoute;
        }

        if (pathname === getAgentSessionToolsRoute('session-1')) {
          return {
            payload: {
              ok: true,
              result: {
                tools: [
                  {
                    name: 'app.alpha.echo',
                    description: 'Alpha',
                    inputSchema: { type: 'object' },
                  },
                  {
                    name: 'app.beta.echo',
                    description: 'Beta',
                    inputSchema: { type: 'object' },
                  },
                ],
              },
            },
          };
        }

        return mockUnknownRoute();
      },
    );

    const session = await attachSession();

    await expect(
      session.tools.getSchema({
        domain: 'app',
        tool: 'echo',
      }),
    ).rejects.toThrow(
      'Ambiguous tool "echo" for domain "app". Matches: app.alpha.echo, app.beta.echo.',
    );
  });

  it('throws the current missing-tool error for domain tools', async () => {
    httpTestHarness.requestHandler.mockImplementation(
      async ({ pathname }: MockHttpRequest): Promise<MockHttpResult> => {
        const sessionRoute = mockAttachedSessionRoute(pathname);
        if (sessionRoute) {
          return sessionRoute;
        }

        if (pathname === getAgentSessionToolsRoute('session-1')) {
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

        return mockUnknownRoute();
      },
    );

    const session = await attachSession();

    await expect(
      session.tools.getSchema({
        domain: 'app',
        tool: 'missing',
      }),
    ).rejects.toThrow(
      'Tool "missing" not found for domain "app". Available: app.echo. Hint: rozenite agent app tools',
    );
  });

  it('suggests known domains when a domain token is unknown', async () => {
    httpTestHarness.requestHandler.mockImplementation(
      async ({ pathname }: MockHttpRequest): Promise<MockHttpResult> => {
        const sessionRoute = mockAttachedSessionRoute(pathname);
        if (sessionRoute) {
          return sessionRoute;
        }

        if (pathname === getAgentSessionToolsRoute('session-1')) {
          return {
            payload: {
              ok: true,
              result: {
                tools: [
                  {
                    name: 'startRecording',
                    description: 'Start network recording',
                    inputSchema: { type: 'object' },
                  },
                ],
              },
            },
          };
        }

        return mockUnknownRoute();
      },
    );

    const session = await attachSession();

    await expect(
      session.tools.list({
        domain: 'netw',
      }),
    ).rejects.toThrow(
      'Unknown domain "netw". Did you mean: network? Run `rozenite agent domains` to list available domains.',
    );
  });

  it('forwards dynamic call arguments once and preserves the result', async () => {
    const calls: Array<{ toolName: string; args: unknown }> = [];

    httpTestHarness.requestHandler.mockImplementation(
      async ({ method, pathname, body }: MockHttpRequest): Promise<MockHttpResult> => {
        const sessionRoute = mockAttachedSessionRoute(pathname);
        if (sessionRoute) {
          return sessionRoute;
        }

        if (pathname === getAgentSessionToolsRoute('session-1')) {
          return {
            payload: {
              ok: true,
              result: {
                tools: [
                  {
                    name: 'listRequests',
                    description: 'List requests',
                    inputSchema: { type: 'object' },
                  },
                ],
              },
            },
          };
        }

        if (method === 'POST' && pathname === getAgentSessionCallToolRoute('session-1')) {
          calls.push(body as { toolName: string; args: unknown });
          return {
            payload: {
              ok: true,
              result: {
                result: {
                  items: [{ id: 1 }],
                  page: { limit: 1, hasMore: true, nextCursor: 'c1' },
                },
              },
            },
          };
        }

        return mockUnknownRoute();
      },
    );

    const session = await attachSession();

    await expect(
      session.tools.call<
        { limit: number },
        {
          items: Array<{ id: number }>;
          page: { limit: number; hasMore: boolean; nextCursor?: string };
        }
      >({
        domain: 'network',
        tool: 'listRequests',
        args: { limit: 1 },
      }),
    ).resolves.toEqual({
      items: [{ id: 1 }],
      page: { limit: 1, hasMore: true, nextCursor: 'c1' },
    });

    expect(calls).toEqual([
      {
        toolName: 'listRequests',
        args: { limit: 1 },
      },
    ]);
  });

  it('resolves a tool schema and call target with a single getSessionTools fetch', async () => {
    const toolsFetches: string[] = [];
    const calls: Array<{ toolName: string; args: unknown }> = [];

    httpTestHarness.requestHandler.mockImplementation(
      async ({ method, pathname, body }: MockHttpRequest): Promise<MockHttpResult> => {
        const sessionRoute = mockAttachedSessionRoute(pathname);
        if (sessionRoute) {
          return sessionRoute;
        }

        if (pathname === getAgentSessionToolsRoute('session-1')) {
          toolsFetches.push(pathname);
          return {
            payload: {
              ok: true,
              result: {
                tools: [
                  {
                    name: 'app.listRequests',
                    description: 'List requests',
                    inputSchema: { type: 'object' },
                    pagination: { kind: 'cursor', fields: ['id'] },
                  },
                ],
              },
            },
          };
        }

        if (method === 'POST' && pathname === getAgentSessionCallToolRoute('session-1')) {
          calls.push(body as { toolName: string; args: unknown });
          return {
            payload: {
              ok: true,
              result: {
                result: {
                  items: [{ id: 1 }],
                  page: { limit: 1, hasMore: false },
                },
              },
            },
          };
        }

        return mockUnknownRoute();
      },
    );

    const session = await attachSession();

    const resolved = await session.tools.resolve({
      domain: 'app',
      tool: 'listRequests',
    });

    expect(resolved.domainId).toBe('app');
    expect(resolved.schema).toEqual({
      name: 'app.listRequests',
      shortName: 'listRequests',
      inputSchema: { type: 'object' },
      pagination: { kind: 'cursor', fields: ['id'] },
    });

    await expect(resolved.call({ limit: 1 })).resolves.toEqual({
      items: [{ id: 1 }],
      page: { limit: 1, hasMore: false },
    });

    // Exactly one getSessionTools fetch for both the schema lookup and the
    // subsequent call, even though they resolve the same (domain, tool).
    expect(toolsFetches).toEqual([getAgentSessionToolsRoute('session-1')]);
    expect(calls).toEqual([
      {
        toolName: 'app.listRequests',
        args: { limit: 1 },
      },
    ]);
  });

  it('calls typed descriptors through the session tool helper', async () => {
    const calls: Array<{ toolName: string; args: unknown }> = [];
    const echoTool = defineAgentToolDescriptor<{ value: string }, { echoed: string }>({
      domain: 'app',
      name: 'echo',
      description: 'Echo the provided value.',
      inputSchema: {
        type: 'object',
        properties: {
          value: { type: 'string' },
        },
        required: ['value'],
      },
    });

    httpTestHarness.requestHandler.mockImplementation(
      async ({ method, pathname, body }: MockHttpRequest): Promise<MockHttpResult> => {
        const sessionRoute = mockAttachedSessionRoute(pathname);
        if (sessionRoute) {
          return sessionRoute;
        }

        if (pathname === getAgentSessionToolsRoute('session-1')) {
          return {
            payload: {
              ok: true,
              result: {
                tools: [
                  {
                    name: 'app.echo',
                    description: 'Echo the provided value.',
                    inputSchema: echoTool.inputSchema,
                  },
                ],
              },
            },
          };
        }

        if (method === 'POST' && pathname === getAgentSessionCallToolRoute('session-1')) {
          calls.push(body as { toolName: string; args: unknown });
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

        return mockUnknownRoute();
      },
    );

    const session = await attachSession();

    await expect(
      session.tools.call(echoTool, {
        value: 'hello from descriptor',
      }),
    ).resolves.toEqual({
      echoed: 'hello from descriptor',
    });
    expect(calls).toEqual([
      {
        toolName: 'app.echo',
        args: { value: 'hello from descriptor' },
      },
    ]);
  });
});
