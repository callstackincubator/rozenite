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

const mockAttachedSessionRoute = (
  pathname: string,
): MockHttpResult | undefined => {
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
  it('lists static and runtime domains with collision-safe plugin slugs', async () => {
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
                    name: '@a/b.list',
                    description: 'Scoped plugin',
                    inputSchema: { type: 'object' },
                  },
                  {
                    name: 'at-a__b.list',
                    description: 'Colliding plugin',
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

    const scoped = domains.find((domain) => domain.pluginId === '@a/b');
    const colliding = domains.find((domain) => domain.pluginId === 'at-a__b');

    expect(scoped?.id).toMatch(/^at-a__b--[a-f0-9]{8}$/);
    expect(colliding?.id).toMatch(/^at-a__b--[a-f0-9]{8}$/);
    expect(scoped?.id).not.toBe(colliding?.id);
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

  it('calls tools without auto-pagination by default', async () => {
    const calls: Array<{ toolName: string; args: unknown }> = [];

    httpTestHarness.requestHandler.mockImplementation(
      async ({
        method,
        pathname,
        body,
      }: MockHttpRequest): Promise<MockHttpResult> => {
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

        if (
          method === 'POST' &&
          pathname === getAgentSessionCallToolRoute('session-1')
        ) {
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

  it('merges paged tool results when auto-pagination is requested', async () => {
    const calls: Array<{
      toolName: string;
      args: { cursor?: string } & Record<string, unknown>;
    }> = [];

    httpTestHarness.requestHandler.mockImplementation(
      async ({
        method,
        pathname,
        body,
      }: MockHttpRequest): Promise<MockHttpResult> => {
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

        if (
          method === 'POST' &&
          pathname === getAgentSessionCallToolRoute('session-1')
        ) {
          const toolCall = body as {
            toolName: string;
            args: { cursor?: string } & Record<string, unknown>;
          };
          calls.push(toolCall);

          if (toolCall.args.cursor === 'c1') {
            return {
              payload: {
                ok: true,
                result: {
                  result: {
                    items: [{ id: 2 }],
                    page: { limit: 1, hasMore: false },
                  },
                },
              },
            };
          }

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
        autoPaginate: { pagesLimit: 2 },
      }),
    ).resolves.toEqual({
      items: [{ id: 1 }, { id: 2 }],
      page: { limit: 1, hasMore: false },
    });

    expect(calls).toEqual([
      {
        toolName: 'listRequests',
        args: { limit: 1 },
      },
      {
        toolName: 'listRequests',
        args: { limit: 1, cursor: 'c1' },
      },
    ]);
  });

  it('calls typed descriptors through the session tool helper', async () => {
    const echoTool = defineAgentToolDescriptor<
      { value: string },
      { echoed: string }
    >({
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
      async ({
        method,
        pathname,
        body,
      }: MockHttpRequest): Promise<MockHttpResult> => {
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

        if (
          method === 'POST' &&
          pathname === getAgentSessionCallToolRoute('session-1')
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
  });
});
