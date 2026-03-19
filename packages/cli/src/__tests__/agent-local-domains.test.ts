import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryDomainService,
  createNetworkDomainService,
  createPerformanceDomainService,
  createReactDomainService,
} from '../commands/agent/local-domains.js';

vi.mock('../commands/agent/runtime/react/store.js', () => ({
  createReactTreeStore: () => {
      const trees = new Map<string, {
        nodes: Map<number, Record<string, unknown>>;
        inspected: Map<number, { props?: unknown; state?: unknown; hooks?: unknown }>;
      }>();

      const getTree = (deviceId: string) => {
        const existing = trees.get(deviceId);
        if (existing) {
          return existing;
        }

        const created = {
          nodes: new Map<number, Record<string, unknown>>(),
          inspected: new Map<number, { props?: unknown; state?: unknown; hooks?: unknown }>(),
        };
        trees.set(deviceId, created);
        return created;
      };

      return {
        registerDevice: () => {},
        unregisterDevice: (deviceId: string) => {
          trees.delete(deviceId);
        },
        ingestReactDevToolsMessage: async (deviceId: string, message: Record<string, any>) => {
          const tree = getTree(deviceId);
          if (message.event === 'tree-sync') {
            tree.nodes.clear();
            for (const node of message.payload.nodes || []) {
              tree.nodes.set(node.nodeId, node);
            }
            tree.inspected.clear();
          }

          if (message.event === 'inspectedElement') {
            tree.inspected.set(message.payload.id, message.payload.value || {});
          }
        },
        searchNodes: (deviceId: string, args: Record<string, any>) => {
          const query = String(args.query || '').toLowerCase();
          const tree = getTree(deviceId);
          return {
            items: Array.from(tree.nodes.values())
              .filter((node) => String(node.displayName || '').toLowerCase().includes(query))
              .map((node) => ({
                nodeId: node.nodeId as number,
                displayName: node.displayName as string,
                elementType: node.elementType as string,
                childCount: Array.isArray(node.childIds) ? node.childIds.length : 0,
                ...(node.parentId !== undefined ? { parentId: node.parentId as number } : {}),
              })),
            page: {
              limit: 20,
              hasMore: false,
            },
          };
        },
        getNode: () => {
          throw new Error('not implemented');
        },
        getChildren: () => {
          throw new Error('not implemented');
        },
        getProps: async (deviceId: string, args: Record<string, any>) => {
          const tree = getTree(deviceId);
          const props = tree.inspected.get(args.nodeId)?.props as Record<string, unknown> | undefined;
          return {
            items: Object.entries(props || {}).map(([name, value]) => ({ name, value })),
            page: {
              limit: 20,
              hasMore: false,
            },
          };
        },
        getState: async () => {
          throw new Error('not implemented');
        },
        getHooks: async () => {
          throw new Error('not implemented');
        },
        startProfiling: async () => {
          throw new Error('not implemented');
        },
        isProfilingStarted: async () => {
          throw new Error('not implemented');
        },
        stopProfiling: async () => {
          throw new Error('not implemented');
        },
        getRenderData: async () => {
          throw new Error('not implemented');
        },
      };
    },
}));

type Listener = (params: Record<string, unknown>) => void | Promise<void>;

const createEventHub = () => {
  const listeners = new Map<string, Set<Listener>>();

  const subscribe = (method: string, listener: Listener) => {
    const methodListeners = listeners.get(method) || new Set<Listener>();
    methodListeners.add(listener);
    listeners.set(method, methodListeners);

    return () => {
      const current = listeners.get(method);
      if (!current) {
        return;
      }
      current.delete(listener);
      if (current.size === 0) {
        listeners.delete(method);
      }
    };
  };

  const emit = async (method: string, params: Record<string, unknown>) => {
    const methodListeners = listeners.get(method);
    if (!methodListeners) {
      return;
    }

    for (const listener of methodListeners) {
      await listener(params);
    }
  };

  return { subscribe, emit };
};

describe('agent local domains', () => {
  let tempDir: string | null = null;

  afterEach(async () => {
    if (!tempDir) {
      return;
    }

    await fs.rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  });

  it('exports traces to file without returning trace payloads', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-trace-test-'));
    const tracePath = path.join(tempDir, 'trace.json');
    const events = createEventHub();
    const commands: string[] = [];

    const service = createPerformanceDomainService({
      getSessionInfo: () => ({
        sessionId: 'session-1',
        deviceId: 'device-1',
        pageId: 'page-1',
      }),
      subscribeToCDPEvent: events.subscribe,
      sendCommand: async (method, params) => {
        commands.push(method);

        if (method === 'Tracing.end') {
          queueMicrotask(() => {
            void events.emit('Tracing.dataCollected', {
              value: [{ name: 'first' }, { name: 'second' }],
            });
            void events.emit('Tracing.tracingComplete', { dataLossOccurred: false });
          });
          return {};
        }

        if (method === 'Tracing.start') {
          return {};
        }

        throw new Error(`Unexpected command ${method} with ${JSON.stringify(params)}`);
      },
    });

    await service.callTool('startTrace', {});
    const result = await service.callTool('stopTrace', { filePath: tracePath }) as {
      artifact: { path: string; bytes: number };
    };

    expect(result.artifact.path).toBe(tracePath);
    expect(result.artifact.bytes).toBeGreaterThan(0);
    expect(commands).toEqual(['Tracing.start', 'Tracing.end']);
    const exported = JSON.parse(await fs.readFile(tracePath, 'utf8'));
    expect(exported.traceEvents).toEqual([{ name: 'first' }, { name: 'second' }]);
    expect(exported.metadata).toMatchObject({
      source: 'DevTools',
      dataOrigin: 'TraceEvents',
      modifications: {
        entriesModifications: {
          hiddenEntries: [],
          expandableEntries: [],
        },
        initialBreadcrumb: {
          window: {
            min: 0,
            max: 0,
            range: 0,
          },
          child: null,
        },
        annotations: {
          entryLabels: [],
          labelledTimeRanges: [],
          linksBetweenEntries: [],
        },
      },
    });
    expect(typeof exported.metadata.startTime).toBe('string');
  });

  it('exports heap snapshot chunks to file', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-heap-test-'));
    const snapshotPath = path.join(tempDir, 'snapshot.heapsnapshot');
    const events = createEventHub();
    const commands: string[] = [];

    const service = createMemoryDomainService({
      getSessionInfo: () => ({
        sessionId: 'session-1',
        deviceId: 'device-1',
        pageId: 'page-1',
      }),
      subscribeToCDPEvent: events.subscribe,
      sendCommand: async (method) => {
        commands.push(method);

        if (method === 'HeapProfiler.enable') {
          return {};
        }

        if (method === 'HeapProfiler.takeHeapSnapshot') {
          await events.emit('HeapProfiler.addHeapSnapshotChunk', { chunk: '{"snapshot":' });
          await events.emit('HeapProfiler.addHeapSnapshotChunk', { chunk: '"ok"}' });
          await events.emit('HeapProfiler.reportHeapSnapshotProgress', { finished: true });
          return {};
        }

        throw new Error(`Unexpected command ${method}`);
      },
    });

    const result = await service.callTool('takeHeapSnapshot', {
      filePath: snapshotPath,
    }) as { artifact: { path: string } };

    expect(result.artifact.path).toBe(snapshotPath);
    expect(commands).toEqual(['HeapProfiler.takeHeapSnapshot']);
    await expect(fs.readFile(snapshotPath, 'utf8')).resolves.toBe('{"snapshot":"ok"}');
  });

  it('records network requests with paginated summaries and explicit detail/body tools', async () => {
    const events = createEventHub();
    const commands: string[] = [];

    const service = createNetworkDomainService({
      getSessionInfo: () => ({
        sessionId: 'session-1',
        deviceId: 'device-1',
        pageId: 'page-1',
      }),
      subscribeToCDPEvent: events.subscribe,
      sendCommand: async (method, params) => {
        commands.push(method);

        if (method === 'Network.enable' || method === 'Network.disable') {
          return {};
        }
        if (method === 'Network.getRequestPostData') {
          return {
            result: {
              postData: params?.requestId === 'request-2'
                ? '{"second":true}'
                : '{"first":true}',
            },
          };
        }
        if (method === 'Network.getResponseBody') {
          return {
            result: {
              body: params?.requestId === 'request-2'
                ? 'second-response'
                : Buffer.from('{"users":[1,2]}', 'utf8').toString('base64'),
              base64Encoded: params?.requestId === 'request-2' ? false : true,
            },
          };
        }

        throw new Error(`Unexpected command ${method}`);
      },
    });

    await service.callTool('startRecording', {});

    await events.emit('Network.requestWillBeSent', {
      requestId: 'request-1',
      timestamp: 1,
      wallTime: 2,
      type: 'XHR',
      request: {
        url: 'https://example.com/first',
        method: 'POST',
        headers: { Accept: 'application/json' },
        hasPostData: true,
      },
    });
    await events.emit('Network.responseReceived', {
      requestId: 'request-1',
      type: 'XHR',
      response: {
        url: 'https://example.com/first',
        status: 201,
        statusText: 'Created',
        mimeType: 'application/json',
        protocol: 'h2',
        headers: { 'Content-Type': 'application/json' },
        encodedDataLength: 120,
      },
    });
    await events.emit('Network.loadingFinished', {
      requestId: 'request-1',
      timestamp: 1.4,
      encodedDataLength: 120,
    });

    await events.emit('Network.requestWillBeSent', {
      requestId: 'request-2',
      timestamp: 3,
      type: 'Fetch',
      request: {
        url: 'https://example.com/second',
        method: 'POST',
        headers: { Accept: 'application/json' },
        hasPostData: true,
      },
    });
    await events.emit('Network.loadingFailed', {
      requestId: 'request-2',
      timestamp: 3.5,
      errorText: 'Failed',
      blockedReason: 'inspector',
    });

    const listPage1 = await service.callTool('listRequests', {
      limit: 1,
    }) as {
      items: Array<Record<string, unknown>>;
      page: { hasMore: boolean; nextCursor?: string };
    };

    expect(listPage1.items).toHaveLength(1);
    expect(listPage1.items[0]).toMatchObject({
      requestId: 'request-2',
      method: 'POST',
      url: 'https://example.com/second',
      outcome: 'failed',
    });
    expect(listPage1.items[0].request).toBeUndefined();
    expect(listPage1.page.hasMore).toBe(true);
    expect(listPage1.page.nextCursor).toBeTruthy();

    const listPage2 = await service.callTool('listRequests', {
      limit: 1,
      cursor: listPage1.page.nextCursor,
    }) as {
      items: Array<Record<string, unknown>>;
      page: { hasMore: boolean };
    };

    expect(listPage2.items).toHaveLength(1);
    expect(listPage2.items[0]).toMatchObject({
      requestId: 'request-1',
      status: 201,
      outcome: 'success',
    });

    const details = await service.callTool('getRequestDetails', {
      requestId: 'request-1',
    }) as { request: Record<string, unknown> };

    expect(details.request).toMatchObject({
      requestId: 'request-1',
      method: 'POST',
      url: 'https://example.com/first',
      loadingFinished: true,
    });
    expect(details.request.request).toMatchObject({
      headers: { Accept: 'application/json' },
      hasPostData: true,
    });
    expect(details.request.response).toMatchObject({
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(details.request.body).toBeUndefined();

    const requestBody = await service.callTool('getRequestBody', {
      requestId: 'request-1',
    }) as Record<string, unknown>;
    expect(requestBody).toMatchObject({
      requestId: 'request-1',
      available: true,
      body: '{"first":true}',
      base64Encoded: false,
    });

    const responseBody = await service.callTool('getResponseBody', {
      requestId: 'request-1',
    }) as Record<string, unknown>;
    expect(responseBody).toMatchObject({
      requestId: 'request-1',
      available: true,
      body: '{"users":[1,2]}',
      base64Encoded: false,
      decoded: true,
      mimeType: 'application/json',
    });

    const failedResponseBody = await service.callTool('getResponseBody', {
      requestId: 'request-2',
    }) as Record<string, unknown>;
    expect(failedResponseBody).toMatchObject({
      requestId: 'request-2',
      available: false,
    });
    expect(typeof failedResponseBody.reason).toBe('string');

    const stopped = await service.callTool('stopRecording', {}) as {
      recording: { isRecording: boolean; requestCount: number };
    };
    expect(stopped.recording).toMatchObject({
      isRecording: false,
      requestCount: 2,
    });

    expect(commands).toEqual([
      'Network.enable',
      'Network.getRequestPostData',
      'Network.getResponseBody',
    ]);
  });

  it('clears previously recorded network requests when a new recording starts', async () => {
    const events = createEventHub();

    const service = createNetworkDomainService({
      getSessionInfo: () => ({
        sessionId: 'session-1',
        deviceId: 'device-1',
        pageId: 'page-1',
      }),
      subscribeToCDPEvent: events.subscribe,
      sendCommand: async (method) => {
        if (method === 'Network.enable') {
          return {};
        }

        throw new Error(`Unexpected command ${method}`);
      },
    });

    await service.callTool('startRecording', {});
    await events.emit('Network.requestWillBeSent', {
      requestId: 'request-1',
      timestamp: 1,
      request: {
        url: 'https://example.com/first',
        method: 'GET',
      },
    });
    await service.callTool('stopRecording', {});

    await service.callTool('startRecording', {});
    const list = await service.callTool('listRequests', {}) as {
      items: Array<Record<string, unknown>>;
      recording: { requestCount: number; generation: number };
    };

    expect(list.items).toEqual([]);
    expect(list.recording.requestCount).toBe(0);
    expect(list.recording.generation).toBe(2);
  });

  it('prefers request.url over documentURL in network summaries', async () => {
    const events = createEventHub();

    const service = createNetworkDomainService({
      getSessionInfo: () => ({
        sessionId: 'session-1',
        deviceId: 'device-1',
        pageId: 'page-1',
      }),
      subscribeToCDPEvent: events.subscribe,
      sendCommand: async (method) => {
        if (method === 'Network.enable') {
          return {};
        }

        throw new Error(`Unexpected command ${method}`);
      },
    });

    await service.callTool('startRecording', {});
    await events.emit('Network.requestWillBeSent', {
      requestId: 'request-1',
      timestamp: 1,
      documentURL: 'mobile',
      request: {
        url: 'https://example.com/real-request',
        method: 'GET',
      },
    });

    const list = await service.callTool('listRequests', {}) as {
      items: Array<Record<string, unknown>>;
    };

    expect(list.items).toHaveLength(1);
    expect(list.items[0]?.url).toBe('https://example.com/real-request');
  });

  it('persists React tree and inspection state inside the daemon local service', async () => {
    const service = createReactDomainService({
      sessionId: 'session-1',
      sendReactDevToolsMessage: () => {},
    });

    await service.captureReactDevToolsMessage?.({
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
    await service.captureReactDevToolsMessage?.({
      event: 'inspectedElement',
      payload: {
        id: 2,
        type: 'full-data',
        value: {
          props: {
            title: 'Hello',
          },
        },
      },
    });

    const search = await service.callTool('searchNodes', {
      query: 'search',
    }) as { items: Array<{ nodeId: number }> };
    expect(search.items.map((item) => item.nodeId)).toEqual([2, 3]);

    const props = await service.callTool('getProps', {
      nodeId: 2,
    }) as { items: Array<{ name: string; value: unknown }> };
    expect(props.items).toEqual([{ name: 'title', value: 'Hello' }]);
  });

  it('falls back to plugin when Network.enable is unsupported and captures plugin events', async () => {
    const events = createEventHub();
    const pluginMessages: Array<{ pluginId: string; type: string; payload: unknown }> = [];
    const pluginListeners = new Map<string, Array<(type: string, payload: unknown) => void>>();

    const service = createNetworkDomainService({
      getSessionInfo: () => ({ sessionId: 'session-1', deviceId: 'device-1', pageId: 'page-1' }),
      subscribeToCDPEvent: events.subscribe,
      sendCommand: async (method) => {
        if (method === 'Network.enable') {
          throw new Error("Unsupported method 'Network.enable'");
        }
        throw new Error(`Unexpected command ${method}`);
      },
      sendPluginMessage: async (pluginId, type, payload) => {
        pluginMessages.push({ pluginId, type, payload });
      },
      subscribeToPluginMessages: (pluginId, listener) => {
        const listeners = pluginListeners.get(pluginId) ?? [];
        listeners.push(listener);
        pluginListeners.set(pluginId, listeners);
        return () => {};
      },
    });

    await service.callTool('startRecording', {});

    expect(pluginMessages).toEqual([
      { pluginId: '@rozenite/network-activity-plugin', type: 'network-enable', payload: {} },
    ]);

    const emit = (type: string, payload: unknown) => {
      for (const listener of pluginListeners.get('@rozenite/network-activity-plugin') ?? []) {
        listener(type, payload);
      }
    };

    emit('request-sent', {
      requestId: 'req-1',
      type: 'XHR',
      timestamp: 1000,
      initiator: { type: 'script' },
      request: {
        url: 'https://example.com/api/data',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        postData: { type: 'text', value: '{"key":"value"}' },
      },
    });

    emit('response-received', {
      requestId: 'req-1',
      type: 'XHR',
      response: {
        url: 'https://example.com/api/data',
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        contentType: 'application/json',
        size: 42,
      },
    });

    emit('request-completed', {
      requestId: 'req-1',
      timestamp: 1300,
      duration: 300,
      size: 42,
      ttfb: 100,
    });

    const list = await service.callTool('listRequests', {}) as {
      items: Array<Record<string, unknown>>;
    };

    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({
      requestId: 'req-1',
      method: 'POST',
      url: 'https://example.com/api/data',
      status: 200,
      outcome: 'success',
      type: 'XHR',
    });

    const requestBody = await service.callTool('getRequestBody', { requestId: 'req-1' }) as Record<string, unknown>;
    expect(requestBody).toMatchObject({
      available: true,
      body: '{"key":"value"}',
    });

    const responseBodyPromise = service.callTool('getResponseBody', { requestId: 'req-1' });
    expect(pluginMessages.at(-1)).toMatchObject({
      pluginId: '@rozenite/network-activity-plugin',
      type: 'get-response-body',
      payload: { requestId: 'req-1' },
    });

    emit('response-body', { requestId: 'req-1', body: '{"result":true}' });

    const responseBody = await responseBodyPromise as Record<string, unknown>;
    expect(responseBody).toMatchObject({
      available: true,
      body: '{"result":true}',
      mimeType: 'application/json',
    });

    pluginMessages.length = 0;
    await service.callTool('stopRecording', {});
    expect(pluginMessages).toEqual([
      { pluginId: '@rozenite/network-activity-plugin', type: 'network-disable', payload: {} },
    ]);
  });

  it('captures plugin request-failed events', async () => {
    const events = createEventHub();
    const pluginListeners = new Map<string, Array<(type: string, payload: unknown) => void>>();

    const service = createNetworkDomainService({
      getSessionInfo: () => ({ sessionId: 'session-1', deviceId: 'device-1', pageId: 'page-1' }),
      subscribeToCDPEvent: events.subscribe,
      sendCommand: async (method) => {
        if (method === 'Network.enable') {
          throw new Error("Unsupported method 'Network.enable'");
        }
        throw new Error(`Unexpected command ${method}`);
      },
      sendPluginMessage: async () => {},
      subscribeToPluginMessages: (pluginId, listener) => {
        const listeners = pluginListeners.get(pluginId) ?? [];
        listeners.push(listener);
        pluginListeners.set(pluginId, listeners);
        return () => {};
      },
    });

    await service.callTool('startRecording', {});

    const emit = (type: string, payload: unknown) => {
      for (const listener of pluginListeners.get('@rozenite/network-activity-plugin') ?? []) {
        listener(type, payload);
      }
    };

    emit('request-sent', {
      requestId: 'req-fail',
      type: 'Fetch',
      timestamp: 2000,
      initiator: { type: 'script' },
      request: { url: 'https://example.com/fail', method: 'GET', headers: {} },
    });
    emit('request-failed', {
      requestId: 'req-fail',
      timestamp: 2500,
      type: 'Fetch',
      error: 'Network timeout',
      canceled: false,
    });

    const list = await service.callTool('listRequests', {}) as {
      items: Array<Record<string, unknown>>;
    };

    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({
      requestId: 'req-fail',
      outcome: 'failed',
    });
  });

  it('sends network-disable via plugin on dispose when using plugin path', async () => {
    const events = createEventHub();
    const pluginMessages: Array<{ type: string }> = [];

    const service = createNetworkDomainService({
      getSessionInfo: () => ({ sessionId: 'session-1', deviceId: 'device-1', pageId: 'page-1' }),
      subscribeToCDPEvent: events.subscribe,
      sendCommand: async (method) => {
        if (method === 'Network.enable') {
          throw new Error("Unsupported method 'Network.enable'");
        }
        throw new Error(`Unexpected command ${method}`);
      },
      sendPluginMessage: async (_pluginId, type) => {
        pluginMessages.push({ type });
      },
      subscribeToPluginMessages: (_pluginId, _listener) => () => {},
    });

    await service.callTool('startRecording', {});
    pluginMessages.length = 0;

    await service.dispose();
    expect(pluginMessages).toEqual([{ type: 'network-disable' }]);
  });
});
