import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAgentMessageHandler } from '../agent/handler.js';
import { AGENT_PLUGIN_ID, type DevToolsPluginMessage, type AgentTool } from '../agent/types.js';

const createTool = (name: string): AgentTool => ({
  name,
  description: `${name} description`,
  inputSchema: { type: 'object', properties: {} },
});

const registerToolsMessage = (tools: AgentTool[]): DevToolsPluginMessage => ({
  pluginId: AGENT_PLUGIN_ID,
  type: 'register-tool',
  payload: { tools },
});

const createReactOperationsPayload = (
  operations: number[],
  strings: string[] = [],
): number[] => {
  const encodedStrings = strings.flatMap((value) => {
    const codePoints = [...value].map((char) => char.codePointAt(0) || 0);
    return [codePoints.length, ...codePoints];
  });

  return [1, 1, encodedStrings.length, ...encodedStrings, ...operations];
};

type MockCommitData = {
  changeDescriptions: Map<number, {
    context: string[] | boolean | null;
    didHooksChange: boolean;
    isFirstMount: boolean;
    props: string[] | null;
    state: string[] | null;
  }> | null;
  duration: number;
  effectDuration: number | null;
  fiberActualDurations: Map<number, number>;
  fiberSelfDurations: Map<number, number>;
  passiveEffectDuration: number | null;
  priorityLevel: string | null;
  timestamp: number;
  updaters: Array<{ id: number }> | null;
};

type MockProfilingRootData = {
  commitData: MockCommitData[];
};

type MockReactBridgeOptions = {
  supportsProfiling?: boolean;
  supportsReloadAndProfile?: boolean;
  isProfilingStarted?: boolean;
  isProcessingData?: boolean;
  profilingDataByRootId?: Map<number, MockProfilingRootData>;
  onStopProfiling?: (state: {
    isProfilingStarted: boolean;
    isProcessingData: boolean;
    profilingDataByRootId: Map<number, MockProfilingRootData>;
  }) => void;
};

const createHandlerWithReactBridge = (bridgeOptions?: MockReactBridgeOptions) => {
  const profilingState = {
    supportsProfiling: bridgeOptions?.supportsProfiling ?? true,
    supportsReloadAndProfile: bridgeOptions?.supportsReloadAndProfile ?? false,
    isProfilingStarted: bridgeOptions?.isProfilingStarted ?? false,
    isProcessingData: bridgeOptions?.isProcessingData ?? false,
    profilingDataByRootId: bridgeOptions?.profilingDataByRootId ?? new Map<number, MockProfilingRootData>(),
  };

  return createAgentMessageHandler({
    createReactDevToolsBridge: async (options) => ({
      ingest: (message: { event: string; payload: unknown }) => {
        if (message.event !== 'tree-sync') {
          return null;
        }
        return message.payload as {
          roots: number[];
          nodes: Array<{
            nodeId: number;
            displayName: string;
            elementType: string;
            parentId?: number;
            key?: string;
            childIds?: number[];
          }>;
        };
      },
      send: (event: string, payload: unknown) => {
        options?.sendMessage?.({ event, payload });
      },
      startProfiling: () => {
        profilingState.isProfilingStarted = true;
      },
      stopProfiling: () => {
        profilingState.isProfilingStarted = false;
        bridgeOptions?.onStopProfiling?.(profilingState);
      },
      reloadAndProfile: () => {
        if (!profilingState.supportsReloadAndProfile) {
          throw new Error('Reload-and-profile is not supported by this React DevTools connection.');
        }
        options?.sendMessage?.({
          event: 'reloadAndProfile',
          payload: {
            recordChangeDescriptions: true,
            recordTimeline: false,
          },
        });
      },
      getProfilingStatus: () => ({
        supportsProfiling: profilingState.supportsProfiling,
        supportsReloadAndProfile: profilingState.supportsReloadAndProfile,
        isProfilingStarted: profilingState.isProfilingStarted,
        isProcessingData: profilingState.isProcessingData,
        hasProfilingData: profilingState.profilingDataByRootId.size > 0,
        rootsWithData: profilingState.profilingDataByRootId.size,
        rootsCount: 1,
      }),
      getProfilingDataSnapshot: () => ({
        dataForRoots: profilingState.profilingDataByRootId,
      }),
      getCommitData: (rootId: number, commitIndex: number) => {
        const root = profilingState.profilingDataByRootId.get(rootId);
        const commitData = root?.commitData?.[commitIndex];
        if (!commitData) {
          throw new Error(`Could not find commit data for root "${rootId}" and commit "${commitIndex}"`);
        }

        return commitData;
      },
    }),
  });
};

describe('AgentMessageHandler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses connected device sender when available', async () => {
    const handler = createHandlerWithReactBridge();
    const sendMessage = vi.fn();

    handler.connectDevice('device-1', 'Device 1', { sendMessage });
    handler.handleDeviceMessage(
      'device-1',
      registerToolsMessage([createTool('app.list-entries')]),
    );

    const resultPromise = handler.callTool('app.list-entries', { key: 'foo' });

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledTimes(1);
    });
    const sentPayload = sendMessage.mock.calls[0][0] as DevToolsPluginMessage;
    const callId = (sentPayload.payload as { callId: string }).callId;

    handler.handleDeviceMessage('device-1', {
      pluginId: AGENT_PLUGIN_ID,
      type: 'tool-result',
      payload: {
        callId,
        success: true,
        result: { ok: true },
      },
    });

    await expect(resultPromise).resolves.toEqual({ ok: true });
  });

  it('keeps tool-not-found error behavior', async () => {
    const handler = createAgentMessageHandler();

    await expect(handler.callTool('app.unknown', {})).rejects.toThrow(
      'Tool "app.unknown" not found',
    );
  });

  it('throws a readable error when no active connection exists for a known tool', async () => {
    const handler = createAgentMessageHandler();
    const sendMessage = vi.fn();

    handler.connectDevice('device-2', 'Device 2', { sendMessage });
    handler.handleDeviceMessage(
      'device-2',
      registerToolsMessage([createTool('app.read-entry')]),
    );
    handler.disconnectDevice('device-2');
    handler.handleDeviceMessage(
      'device-2',
      registerToolsMessage([createTool('app.read-entry')]),
    );

    await expect(handler.callTool('app.read-entry', {})).rejects.toThrow(
      'there is no active DevTools connection',
    );
  });

  it('eagerly initializes react bridge when device connects', async () => {
    const createReactDevToolsBridge = vi.fn(async (options?: {
      sendMessage?: (message: { event: string; payload: unknown }) => void;
    }) => ({
      ingest: () => null,
      send: (event: string, payload: unknown) => {
        options?.sendMessage?.({ event, payload });
      },
      startProfiling: () => {},
      stopProfiling: () => {},
      reloadAndProfile: () => {},
      getProfilingStatus: () => ({
        supportsProfiling: false,
        supportsReloadAndProfile: false,
        isProfilingStarted: false,
        isProcessingData: false,
        hasProfilingData: false,
        rootsWithData: 0,
        rootsCount: 0,
      }),
      getProfilingDataSnapshot: () => null,
      getCommitData: () => {
        throw new Error('not implemented');
      },
    }));

    const handler = createAgentMessageHandler({
      createReactDevToolsBridge,
    });
    handler.connectDevice('device-eager-react', 'Device Eager React', { sendMessage: vi.fn() });

    await vi.waitFor(() => {
      expect(createReactDevToolsBridge).toHaveBeenCalledTimes(1);
    });
  });

  it('exposes paged getMessages results from captured messages', async () => {
    const handler = createAgentMessageHandler();
    const sendMessage = vi.fn();

    handler.connectDevice('device-3', 'Device 3', { sendMessage });
    handler.captureConsoleMessage('device-3', {
      text: 'first',
      level: 'info',
      source: 'console',
      timestamp: 1000,
    });
    handler.captureConsoleMessage('device-3', {
      text: 'second',
      level: 'warning',
      source: 'console',
      timestamp: 2000,
    });

    const firstPage = await handler.callTool('getMessages', { limit: 1 }) as {
      items: Array<{ text: string }>;
      page: { hasMore: boolean; nextCursor?: string };
    };

    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.items[0].text).toBe('second');
    expect(firstPage.page.hasMore).toBe(true);

    const secondPage = await handler.callTool('getMessages', {
      limit: 1,
      cursor: firstPage.page.nextCursor,
    }) as {
      items: Array<{ text: string }>;
    };

    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0].text).toBe('first');
  });

  it('searches React nodes by name with pagination', async () => {
    const handler = createHandlerWithReactBridge();
    const sendMessage = vi.fn();

    handler.connectDevice('device-react-1', 'Device React 1', { sendMessage });
    await handler.captureReactDevToolsMessage('device-react-1', {
      event: 'tree-sync',
      payload: {
        roots: [1],
        nodes: [
          { nodeId: 1, displayName: 'App', elementType: 'function', childIds: [2, 3] },
          { nodeId: 2, displayName: 'SearchInput', elementType: 'function', parentId: 1 },
          { nodeId: 3, displayName: 'SearchResults', elementType: 'function', parentId: 1 },
        ],
      },
    });

    const firstPage = await handler.callTool('searchNodes', {
      query: 'search',
      limit: 1,
    }) as {
      items: Array<{ nodeId: number; displayName: string }>;
      page: { hasMore: boolean; nextCursor?: string };
    };

    expect(firstPage.items[0]).toMatchObject({
      nodeId: 2,
      displayName: 'SearchInput',
    });
    expect(firstPage.page.hasMore).toBe(true);
    expect(firstPage.page.nextCursor).toBeTruthy();

    const secondPage = await handler.callTool('searchNodes', {
      query: 'search',
      limit: 1,
      cursor: firstPage.page.nextCursor,
    }) as {
      items: Array<{ nodeId: number; displayName: string }>;
      page: { hasMore: boolean };
    };

    expect(secondPage.items[0]).toMatchObject({
      nodeId: 3,
      displayName: 'SearchResults',
    });
    expect(secondPage.page.hasMore).toBe(false);
  });

  it('supports name-or-key matching and root scoping', async () => {
    const handler = createHandlerWithReactBridge();
    const sendMessage = vi.fn();

    handler.connectDevice('device-react-2', 'Device React 2', { sendMessage });
    await handler.captureReactDevToolsMessage('device-react-2', {
      event: 'tree-sync',
      payload: {
        roots: [10, 20],
        nodes: [
          { nodeId: 10, displayName: 'RootA', elementType: 'host', childIds: [11] },
          { nodeId: 11, displayName: 'Item', elementType: 'function', key: 'cart-total', parentId: 10 },
          { nodeId: 20, displayName: 'RootB', elementType: 'host', childIds: [21] },
          { nodeId: 21, displayName: 'Item', elementType: 'function', key: 'wishlist', parentId: 20 },
        ],
      },
    });

    const scoped = await handler.callTool('searchNodes', {
      query: 'cart',
      match: 'name-or-key',
      rootId: 10,
    }) as { items: Array<{ nodeId: number }> };

    expect(scoped.items.map((item) => item.nodeId)).toEqual([11]);
  });

  it('validates query and cursor context for searchNodes', async () => {
    const handler = createHandlerWithReactBridge();
    const sendMessage = vi.fn();

    handler.connectDevice('device-react-3', 'Device React 3', { sendMessage });
    await handler.captureReactDevToolsMessage('device-react-3', {
      event: 'tree-sync',
      payload: {
        roots: [1],
        nodes: [
          { nodeId: 1, displayName: 'Root', elementType: 'function', childIds: [2, 3] },
          { nodeId: 2, displayName: 'Alpha', elementType: 'function', parentId: 1 },
          { nodeId: 3, displayName: 'Alpine', elementType: 'function', parentId: 1 },
        ],
      },
    });

    await expect(handler.callTool('searchNodes', { query: '   ' })).rejects.toThrow(
      '"query" must be a non-empty string',
    );

    const firstPage = await handler.callTool('searchNodes', {
      query: 'a',
      limit: 1,
    }) as {
      page: { nextCursor?: string };
    };

    await expect(handler.callTool('searchNodes', {
      query: 'root',
      cursor: firstPage.page.nextCursor,
    })).rejects.toThrow('Cursor does not match this request context');
  });

  it('returns a readable error when rootId is missing from the current tree', async () => {
    const handler = createHandlerWithReactBridge();
    const sendMessage = vi.fn();

    handler.connectDevice('device-react-4', 'Device React 4', { sendMessage });
    await handler.captureReactDevToolsMessage('device-react-4', {
      event: 'tree-sync',
      payload: {
        roots: [1],
        nodes: [{ nodeId: 1, displayName: 'Root', elementType: 'function' }],
      },
    });

    await expect(handler.callTool('searchNodes', {
      query: 'root',
      rootId: 999,
    })).rejects.toThrow('Node "999" no longer exists in the current React tree.');
  });

  it('ingests react-devtools bridge tree-sync messages', async () => {
    const handler = createHandlerWithReactBridge();
    const sendMessage = vi.fn();

    handler.connectDevice('device-react-5', 'Device React 5', { sendMessage });
    await handler.captureReactDevToolsMessage('device-react-5', {
      event: 'tree-sync',
      payload: {
        roots: [100],
        nodes: [
          { nodeId: 100, displayName: 'Root', elementType: 'function', childIds: [101] },
          { nodeId: 101, displayName: 'Leaf', elementType: 'host', parentId: 100 },
        ],
      },
    });

    const result = await handler.callTool('searchNodes', {
      query: 'leaf',
    }) as {
      items: Array<{ nodeId: number }>;
    };

    expect(result.items.map((item) => item.nodeId)).toEqual([101]);
  });

  it('ingests react-devtools operations payloads end-to-end', async () => {
    const handler = createAgentMessageHandler();
    const sendMessage = vi.fn();
    handler.connectDevice('device-react-ops', 'Device React Ops', { sendMessage });

    await handler.captureReactDevToolsMessage('device-react-ops', {
      event: 'operations',
      payload: createReactOperationsPayload([
        1, 1, 11, 0, 0, 0, 0,
        1, 2, 5, 1, 0, 1, 0,
      ], ['Leaf']),
    });

    const result = await handler.callTool('searchNodes', {
      query: 'leaf',
    }) as {
      items: Array<{ nodeId: number }>;
    };

    expect(result.items.map((item) => item.nodeId)).toEqual([2]);
  });

  it('does not send any outbound device messages while ingesting react-devtools events', async () => {
    const handler = createHandlerWithReactBridge();
    const sendMessage = vi.fn();

    handler.connectDevice('device-react-6', 'Device React 6', { sendMessage });
    await handler.captureReactDevToolsMessage('device-react-6', {
      event: 'tree-sync',
      payload: {
        roots: [1],
        nodes: [{ nodeId: 1, displayName: 'Root', elementType: 'function' }],
      },
    });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('exposes React Agent tools in tool list and injects deviceId schema for multi-device', () => {
    const handler = createAgentMessageHandler();

    handler.connectDevice('device-a', 'Device A', { sendMessage: vi.fn() });
    handler.connectDevice('device-b', 'Device B', { sendMessage: vi.fn() });

    const tools = handler.getTools();
    const searchTool = tools.find((tool) => tool.name === 'searchNodes');
    const startProfilingTool = tools.find((tool) => tool.name === 'startProfiling');
    const profilingStatusTool = tools.find((tool) => tool.name === 'isProfilingStarted');
    const stopProfilingTool = tools.find((tool) => tool.name === 'stopProfiling');
    const renderDataTool = tools.find((tool) => tool.name === 'getRenderData');

    expect(searchTool).toBeTruthy();
    expect(searchTool?.inputSchema.properties?.deviceId).toBeTruthy();
    expect(searchTool?.inputSchema.required).toContain('deviceId');
    expect(startProfilingTool).toBeTruthy();
    expect(profilingStatusTool).toBeTruthy();
    expect(stopProfilingTool).toBeTruthy();
    expect(renderDataTool).toBeTruthy();
    expect(renderDataTool?.inputSchema.required).toEqual(expect.arrayContaining(['deviceId', 'rootId', 'commitIndex']));
  });

  it('returns node summary with getNode', async () => {
    const handler = createHandlerWithReactBridge();
    handler.connectDevice('device-react-7', 'Device React 7', { sendMessage: vi.fn() });

    await handler.captureReactDevToolsMessage('device-react-7', {
      event: 'tree-sync',
      payload: {
        roots: [1],
        nodes: [
          { nodeId: 1, displayName: 'App', elementType: 'function', childIds: [2] },
          { nodeId: 2, displayName: 'Leaf', elementType: 'host', parentId: 1 },
        ],
      },
    });

    const result = await handler.callTool('getNode', { nodeId: 2 }) as {
      nodeId: number;
      displayName: string;
      parentId?: number;
    };

    expect(result).toMatchObject({
      nodeId: 2,
      displayName: 'Leaf',
      parentId: 1,
    });
  });

  it('returns paginated children with getChildren', async () => {
    const handler = createHandlerWithReactBridge();
    handler.connectDevice('device-react-8', 'Device React 8', { sendMessage: vi.fn() });

    await handler.captureReactDevToolsMessage('device-react-8', {
      event: 'tree-sync',
      payload: {
        roots: [10],
        nodes: [
          { nodeId: 10, displayName: 'Root', elementType: 'function', childIds: [11, 12] },
          { nodeId: 11, displayName: 'A', elementType: 'function', parentId: 10 },
          { nodeId: 12, displayName: 'B', elementType: 'function', parentId: 10 },
        ],
      },
    });

    const first = await handler.callTool('getChildren', {
      nodeId: 10,
      limit: 1,
    }) as {
      items: Array<{ nodeId: number }>;
      page: { hasMore: boolean; nextCursor?: string };
    };

    expect(first.items.map((item) => item.nodeId)).toEqual([11]);
    expect(first.page.hasMore).toBe(true);

    const second = await handler.callTool('getChildren', {
      nodeId: 10,
      limit: 1,
      cursor: first.page.nextCursor,
    }) as {
      items: Array<{ nodeId: number }>;
      page: { hasMore: boolean };
    };

    expect(second.items.map((item) => item.nodeId)).toEqual([12]);
    expect(second.page.hasMore).toBe(false);
  });

  it('returns paginated props/state from inspectedElement payloads', async () => {
    const handler = createHandlerWithReactBridge();
    handler.connectDevice('device-react-9', 'Device React 9', { sendMessage: vi.fn() });

    await handler.captureReactDevToolsMessage('device-react-9', {
      event: 'tree-sync',
      payload: {
        roots: [20],
        nodes: [
          { nodeId: 20, displayName: 'Root', elementType: 'function', childIds: [21], rendererId: 1 },
          { nodeId: 21, displayName: 'Details', elementType: 'function', parentId: 20, rendererId: 1 },
        ],
      },
    });

    await handler.captureReactDevToolsMessage('device-react-9', {
      event: 'inspectedElement',
      payload: {
        id: 21,
        type: 'full-data',
        value: {
          props: {
            title: 'hello',
            count: 2,
          },
          state: {
            loading: false,
            step: 3,
          },
          hooks: [
            {
              name: 'Navigation',
              value: null,
              subHooks: [
                { name: 'Route', value: 'Home' },
                { name: 'Params', value: { id: 42 } },
              ],
            },
            { name: 'Memo', value: 'cached' },
          ],
        },
      },
    });

    const propsPage = await handler.callTool('getProps', {
      nodeId: 21,
      limit: 1,
    }) as {
      items: Array<{ name: string }>;
      page: { hasMore: boolean; nextCursor?: string };
    };
    expect(propsPage.items).toHaveLength(1);
    expect(propsPage.page.hasMore).toBe(true);

    const statePage = await handler.callTool('getState', {
      nodeId: 21,
    }) as {
      items: Array<{ name: string; value: unknown }>;
    };
    expect(statePage.items.map((item) => item.name).sort()).toEqual(['loading', 'step']);

    const hooksPage = await handler.callTool('getHooks', {
      nodeId: 21,
    }) as {
      items: Array<{ name: string; value: unknown }>;
    };
    expect(hooksPage.items.map((item) => item.name)).toEqual([
      '0 (Navigation)',
      '0.subHooks.0 (Route)',
      '0.subHooks.1 (Params)',
      '1 (Memo)',
    ]);

    const nestedHooks = await handler.callTool('getHooks', {
      nodeId: 21,
      path: [0, 'subHooks'],
    }) as {
      items: Array<{ name: string; value: unknown }>;
    };
    expect(nestedHooks.items.map((item) => item.name)).toEqual([
      '0 (Route)',
      '1 (Params)',
    ]);

    const nestedHookLeaf = await handler.callTool('getHooks', {
      nodeId: 21,
      path: [0, 'subHooks', 0],
    }) as {
      items: Array<{ name: string; value: unknown }>;
    };
    expect(nestedHookLeaf.items).toEqual([{ name: 'value (Route)', value: 'Home' }]);

    await expect(handler.callTool('getHooks', {
      nodeId: 21,
      path: ['doesNotExist'],
    })).rejects.toThrow('expects an object');
  });

  it('invalidates inspected snapshots after tree-sync updates', async () => {
    vi.useFakeTimers();
    const handler = createHandlerWithReactBridge();
    handler.connectDevice('device-react-stale', 'Device React Stale', {
      sendMessage: vi.fn(),
      sendReactDevToolsMessage: vi.fn(),
    });

    await handler.captureReactDevToolsMessage('device-react-stale', {
      event: 'tree-sync',
      payload: {
        roots: [20],
        nodes: [
          { nodeId: 20, displayName: 'Root', elementType: 'function', childIds: [21] },
          { nodeId: 21, displayName: 'Details', elementType: 'function', parentId: 20 },
        ],
      },
    });
    await handler.captureReactDevToolsMessage('device-react-stale', {
      event: 'inspectedElement',
      payload: {
        id: 21,
        type: 'full-data',
        value: {
          props: { title: 'before-sync' },
        },
      },
    });

    const first = await handler.callTool('getProps', { nodeId: 21 }) as {
      items: Array<{ name: string; value: unknown }>;
    };
    expect(first.items).toEqual([{ name: 'title', value: 'before-sync' }]);

    await handler.captureReactDevToolsMessage('device-react-stale', {
      event: 'tree-sync',
      payload: {
        roots: [20],
        nodes: [
          { nodeId: 20, displayName: 'Root', elementType: 'function', childIds: [21], rendererId: 1 },
          { nodeId: 21, displayName: 'DetailsRenamed', elementType: 'function', parentId: 20, rendererId: 1 },
        ],
      },
    });

    const pending = handler.callTool('getProps', { nodeId: 21 });
    const pendingExpectation = expect(pending).rejects.toThrow(
      'No props snapshot available for node "21". React DevTools did not return inspected data for this node.',
    );
    await vi.advanceTimersByTimeAsync(2500);
    await pendingExpectation;
  });

  it('requests inspected element data when props/state/hooks are missing', async () => {
    const handler = createHandlerWithReactBridge();
    const sendReactDevToolsMessage = vi.fn((message: { event: string; payload: unknown }) => {
      if (message.event !== 'inspectElement') {
        return;
      }

      void handler.captureReactDevToolsMessage('device-react-10', {
        event: 'inspectedElement',
        payload: {
          id: 30,
          type: 'full-data',
          value: {
            props: { label: 'from-backend' },
            state: { visible: true },
            hooks: [{ name: 'State', value: 1 }],
          },
        },
      });
    });

    handler.connectDevice('device-react-10', 'Device React 10', {
      sendMessage: vi.fn(),
      sendReactDevToolsMessage,
    });

    await handler.captureReactDevToolsMessage('device-react-10', {
      event: 'tree-sync',
      payload: {
        roots: [30],
        nodes: [{
          nodeId: 30,
          displayName: 'Root',
          elementType: 'function',
          rendererId: 1,
        }],
      },
    });

    const props = await handler.callTool('getProps', { nodeId: 30 }) as {
      items: Array<{ name: string; value: unknown }>;
    };

    expect(sendReactDevToolsMessage).toHaveBeenCalled();
    expect(props.items).toContainEqual({
      name: 'label',
      value: 'from-backend',
    });

    const hooks = await handler.callTool('getHooks', { nodeId: 30 }) as {
      items: Array<{ name: string }>;
    };
    expect(hooks.items.map((item) => item.name)).toEqual(['0 (State)']);
  });

  it('returns a readable error when inspected props/state/hooks are still unavailable', async () => {
    const handler = createHandlerWithReactBridge();
    handler.connectDevice('device-react-11', 'Device React 11', {
      sendMessage: vi.fn(),
      sendReactDevToolsMessage: vi.fn(),
    });

    await handler.captureReactDevToolsMessage('device-react-11', {
      event: 'tree-sync',
      payload: {
        roots: [30],
        nodes: [{ nodeId: 30, displayName: 'Root', elementType: 'function', rendererId: 1 }],
      },
    });

    await expect(handler.callTool('getHooks', { nodeId: 30 })).rejects.toThrow(
      'React DevTools did not return inspected data for this node.',
    );
  });

  it('starts profiling and exposes profiling status', async () => {
    const handler = createHandlerWithReactBridge();
    handler.connectDevice('device-react-prof-1', 'Device React Profiler 1', { sendMessage: vi.fn() });

    const startResult = await handler.callTool('startProfiling', {}) as {
      ok: boolean;
      status: { isProfilingStarted: boolean; isProcessingData: boolean };
    };
    expect(startResult.ok).toBe(true);
    expect(startResult.status.isProfilingStarted).toBe(true);
    expect(startResult.status.isProcessingData).toBe(false);

    const statusResult = await handler.callTool('isProfilingStarted', {}) as {
      isProfilingStarted: boolean;
      isProcessingData: boolean;
      hasProfilingData: boolean;
      rootsWithData: number;
    };
    expect(statusResult).toEqual({
      isProfilingStarted: true,
      isProcessingData: false,
      hasProfilingData: false,
      rootsWithData: 0,
    });
  });

  it('supports restart profiling when reload-and-profile is available', async () => {
    const handler = createHandlerWithReactBridge({
      supportsReloadAndProfile: true,
    });
    const sendReactDevToolsMessage = vi.fn();
    handler.connectDevice('device-react-prof-2', 'Device React Profiler 2', {
      sendMessage: vi.fn(),
      sendReactDevToolsMessage,
    });

    const result = await handler.callTool('startProfiling', {
      shouldRestart: true,
    }) as {
      ok: boolean;
      status: { isProfilingStarted: boolean; isProcessingData: boolean };
    };

    expect(result.ok).toBe(true);
    expect(sendReactDevToolsMessage).toHaveBeenCalledWith({
      event: 'reloadAndProfile',
      payload: {
        recordChangeDescriptions: true,
        recordTimeline: false,
      },
    });
  });

  it('returns an explicit error when restart profiling is unsupported', async () => {
    const handler = createHandlerWithReactBridge({
      supportsReloadAndProfile: false,
    });
    handler.connectDevice('device-react-prof-3', 'Device React Profiler 3', { sendMessage: vi.fn() });

    await expect(handler.callTool('startProfiling', {
      shouldRestart: true,
    })).rejects.toThrow('Reload-and-profile is not supported');
  });

  it('stops profiling and returns a compact summary', async () => {
    const profilingDataByRootId = new Map<number, MockProfilingRootData>([
      [1, {
        commitData: [
          {
            changeDescriptions: null,
            duration: 8,
            effectDuration: null,
            fiberActualDurations: new Map([[10, 6]]),
            fiberSelfDurations: new Map([[10, 3]]),
            passiveEffectDuration: null,
            priorityLevel: 'Normal',
            timestamp: 101,
            updaters: null,
          },
          {
            changeDescriptions: null,
            duration: 28,
            effectDuration: null,
            fiberActualDurations: new Map([[11, 22]]),
            fiberSelfDurations: new Map([[11, 12]]),
            passiveEffectDuration: null,
            priorityLevel: 'Normal',
            timestamp: 120,
            updaters: null,
          },
        ],
      }],
    ]);
    const handler = createHandlerWithReactBridge({
      isProfilingStarted: true,
      profilingDataByRootId,
    });
    handler.connectDevice('device-react-prof-4', 'Device React Profiler 4', { sendMessage: vi.fn() });

    const result = await handler.callTool('stopProfiling', {
      slowRenderThresholdMs: 16,
    }) as {
      session: { roots: number[]; totalCommits: number; totalRenderDurationMs: number };
      renders: { count: number; slowCount: number; slowThresholdMs: number };
      topSlowCommits: Array<{ rootId: number; commitIndex: number; durationMs: number; timestampMs: number }>;
      truncated: boolean;
    };

    expect(result.session).toEqual({
      roots: [1],
      totalCommits: 2,
      totalRenderDurationMs: 36,
    });
    expect(result.renders).toEqual({
      count: 2,
      slowCount: 1,
      slowThresholdMs: 16,
    });
    expect(result.topSlowCommits).toEqual([{
      rootId: 1,
      commitIndex: 1,
      durationMs: 28,
      timestampMs: 120,
    }]);
    expect(result.truncated).toBe(false);
  });

  it('returns partial profiling summary when data processing exceeds timeout', async () => {
    vi.useFakeTimers();
    const handler = createHandlerWithReactBridge({
      isProfilingStarted: true,
      isProcessingData: true,
      onStopProfiling: (state) => {
        state.isProcessingData = true;
      },
    });
    handler.connectDevice('device-react-prof-5', 'Device React Profiler 5', { sendMessage: vi.fn() });

    const resultPromise = handler.callTool('stopProfiling', {
      waitForDataMs: 5,
    }) as Promise<{ partial?: boolean; isProcessingData?: boolean }>;
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.partial).toBe(true);
    expect(result.isProcessingData).toBe(true);
  });

  it('returns paged render data for a commit and validates cursor context', async () => {
    const profilingDataByRootId = new Map<number, MockProfilingRootData>([
      [5, {
        commitData: [{
          changeDescriptions: new Map([
            [101, {
              context: null,
              didHooksChange: true,
              isFirstMount: false,
              props: ['value'],
              state: null,
            }],
          ]),
          duration: 18,
          effectDuration: 1,
          fiberActualDurations: new Map([
            [101, 12],
            [102, 4],
          ]),
          fiberSelfDurations: new Map([
            [101, 8],
            [102, 2],
          ]),
          passiveEffectDuration: 0,
          priorityLevel: 'Normal',
          timestamp: 222,
          updaters: [{ id: 101 }],
        }],
      }],
    ]);
    const handler = createHandlerWithReactBridge({
      profilingDataByRootId,
    });
    handler.connectDevice('device-react-prof-6', 'Device React Profiler 6', { sendMessage: vi.fn() });
    await handler.captureReactDevToolsMessage('device-react-prof-6', {
      event: 'tree-sync',
      payload: {
        roots: [5],
        nodes: [
          { nodeId: 5, displayName: 'Root', elementType: 'function', childIds: [101, 102] },
          { nodeId: 101, displayName: 'Alpha', elementType: 'function', parentId: 5 },
          { nodeId: 102, displayName: 'Beta', elementType: 'function', parentId: 5 },
        ],
      },
    });

    const first = await handler.callTool('getRenderData', {
      rootId: 5,
      commitIndex: 0,
      limit: 1,
      slowRenderThresholdMs: 10,
    }) as {
      commit: { durationMs: number };
      summary: { renderedFiberCount: number; slowFiberCount: number };
      items: Array<{ fiberId: number; isSlow: boolean; changeTypeHints?: string[] }>;
      page: { hasMore: boolean; nextCursor?: string };
    };

    expect(first.commit.durationMs).toBe(18);
    expect(first.summary).toEqual({
      renderedFiberCount: 2,
      slowFiberCount: 1,
      slowRenderThresholdMs: 10,
      updaterCount: 1,
      hasChangeDescriptions: true,
    });
    expect(first.items[0]).toMatchObject({
      fiberId: 101,
      isSlow: true,
      changeTypeHints: ['props', 'hooks'],
    });
    expect(first.page.hasMore).toBe(true);

    const second = await handler.callTool('getRenderData', {
      rootId: 5,
      commitIndex: 0,
      limit: 1,
      slowRenderThresholdMs: 10,
      cursor: first.page.nextCursor,
    }) as {
      items: Array<{ fiberId: number }>;
      page: { hasMore: boolean };
    };
    expect(second.items[0].fiberId).toBe(102);
    expect(second.page.hasMore).toBe(false);

    await expect(handler.callTool('getRenderData', {
      rootId: 5,
      commitIndex: 0,
      sort: 'name-asc',
      cursor: first.page.nextCursor,
      slowRenderThresholdMs: 10,
    })).rejects.toThrow('Cursor does not match this request context');
  });
});
