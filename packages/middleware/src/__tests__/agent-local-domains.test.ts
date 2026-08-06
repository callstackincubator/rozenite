import { describe, expect, it, vi } from 'vitest';
import {
  createMemoryDomainService,
  createNetworkDomainService,
  createReactDomainService,
} from '../agent/local-domains.js';

const waitForWriteCalls = async (
  fn: { mock: { calls: unknown[] } },
  count: number,
): Promise<void> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (fn.mock.calls.length >= count) {
      return;
    }

    await Promise.resolve();
  }

  expect(fn.mock.calls.length).toBeGreaterThanOrEqual(count);
};

describe('paginated local domain contracts', () => {
  it('publishes row metadata from React and network tool definitions', async () => {
    const react = createReactDomainService({
      sessionId: 'session-1',
      sendReactDevToolsMessage() {},
    });
    const network = createNetworkDomainService({
      getSessionInfo: () => ({
        sessionId: 'session-1',
        pageId: 'page-1',
        deviceId: 'device-1',
      }),
      sendCommand: async () => ({}),
      subscribeToCDPEvent: () => () => {},
    });

    expect(react.getTools().find((tool) => tool.name === 'getTree')?.pagination).toMatchObject({
      kind: 'cursor',
      fields: expect.arrayContaining(['nodeId', 'childIds', 'depth']),
    });
    expect(
      network.getTools().find((tool) => tool.name === 'listRequests')?.pagination,
    ).toMatchObject({
      kind: 'cursor',
      fields: expect.arrayContaining(['requestId', 'url', 'status']),
    });

    await react.dispose();
    await network.dispose();
  });

  it('trims defaultFields narrower than the full field set for migrated tools', async () => {
    const react = createReactDomainService({
      sessionId: 'session-1',
      sendReactDevToolsMessage() {},
    });
    const network = createNetworkDomainService({
      getSessionInfo: () => ({
        sessionId: 'session-1',
        pageId: 'page-1',
        deviceId: 'device-1',
      }),
      sendCommand: async () => ({}),
      subscribeToCDPEvent: () => () => {},
    });

    const getTreePagination = react.getTools().find((tool) => tool.name === 'getTree')?.pagination;
    const listRequestsPagination = network
      .getTools()
      .find((tool) => tool.name === 'listRequests')?.pagination;

    expect(getTreePagination?.defaultFields?.length).toBeLessThan(
      getTreePagination?.fields.length ?? 0,
    );
    expect(getTreePagination?.defaultFields).not.toContain('childIds');
    for (const field of getTreePagination?.defaultFields ?? []) {
      expect(getTreePagination?.fields).toContain(field);
    }

    expect(listRequestsPagination?.defaultFields?.length).toBeLessThan(
      listRequestsPagination?.fields.length ?? 0,
    );
    expect(listRequestsPagination?.defaultFields).not.toContain('type');
    for (const field of listRequestsPagination?.defaultFields ?? []) {
      expect(listRequestsPagination?.fields).toContain(field);
    }

    await react.dispose();
    await network.dispose();
  });
});

describe('memory domain service', () => {
  it('waits for pending heap snapshot chunk writes before finalizing', async () => {
    const listeners = new Map<
      string,
      Set<(params: Record<string, unknown>) => void | Promise<void>>
    >();
    const writeResolvers: Array<() => void> = [];
    const write = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          writeResolvers.push(resolve);
        }),
    );
    const finalize = vi.fn(async () => ({
      path: '/tmp/snapshot.heapsnapshot',
      relativePath: '.rozenite/agent/sessions/device-1/memory/snapshot.heapsnapshot',
      bytes: 10,
      bucket: 'memory' as const,
      fileName: 'snapshot.heapsnapshot',
    }));
    const abort = vi.fn(async () => undefined);

    const subscribeToCDPEvent = (
      method: string,
      listener: (params: Record<string, unknown>) => void | Promise<void>,
    ) => {
      const entries = listeners.get(method) || new Set();
      entries.add(listener);
      listeners.set(method, entries);

      return () => {
        entries.delete(listener);
        if (entries.size === 0) {
          listeners.delete(method);
        }
      };
    };

    const emit = (method: string, params: Record<string, unknown>) => {
      for (const listener of listeners.get(method) || []) {
        void listener(params);
      }
    };

    const service = createMemoryDomainService({
      getSessionInfo: () => ({
        sessionId: 'device-1',
        pageId: 'page-1',
        deviceId: 'device-1',
      }),
      sendCommand: async (method) => {
        if (method === 'HeapProfiler.takeHeapSnapshot') {
          emit('HeapProfiler.addHeapSnapshotChunk', { chunk: 'chunk-1' });
          emit('HeapProfiler.addHeapSnapshotChunk', { chunk: 'chunk-2' });
          emit('HeapProfiler.reportHeapSnapshotProgress', { finished: true });
        }

        return {};
      },
      subscribeToCDPEvent,
      createArtifactWriter: async () => ({
        path: '/tmp/snapshot.heapsnapshot',
        relativePath: '.rozenite/agent/sessions/device-1/memory/snapshot.heapsnapshot',
        fileName: 'snapshot.heapsnapshot',
        bucket: 'memory',
        write,
        finalize,
        abort,
      }),
    });

    let settled = false;
    const resultPromise = service.callTool('takeHeapSnapshot', {}).finally(() => {
      settled = true;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(write).toHaveBeenCalledTimes(1);
    expect(finalize).not.toHaveBeenCalled();
    expect(settled).toBe(false);

    writeResolvers.shift()?.();
    await waitForWriteCalls(write, 2);

    expect(finalize).not.toHaveBeenCalled();
    expect(settled).toBe(false);

    writeResolvers.shift()?.();

    await expect(resultPromise).resolves.toMatchObject({
      artifact: {
        path: '/tmp/snapshot.heapsnapshot',
        bucket: 'memory',
      },
      timing: {
        startedAt: expect.any(Number),
        finishedAt: expect.any(Number),
        durationMs: expect.any(Number),
      },
    });

    expect(finalize).toHaveBeenCalledTimes(1);
    expect(abort).not.toHaveBeenCalled();
  });
});

describe('network domain service', () => {
  it('clears the captured request buffer and bumps the generation on disconnect', async () => {
    const listeners = new Map<
      string,
      Set<(params: Record<string, unknown>) => void | Promise<void>>
    >();

    const subscribeToCDPEvent = (
      method: string,
      listener: (params: Record<string, unknown>) => void | Promise<void>,
    ) => {
      const entries = listeners.get(method) || new Set();
      entries.add(listener);
      listeners.set(method, entries);

      return () => {
        entries.delete(listener);
        if (entries.size === 0) {
          listeners.delete(method);
        }
      };
    };

    const emit = (method: string, params: Record<string, unknown>) => {
      for (const listener of listeners.get(method) || []) {
        void listener(params);
      }
    };

    const service = createNetworkDomainService({
      getSessionInfo: () => ({
        sessionId: 'device-1',
        pageId: 'page-1',
        deviceId: 'device-1',
      }),
      sendCommand: async () => ({}),
      subscribeToCDPEvent,
    });

    await service.callTool('startRecording', {});
    emit('Network.requestWillBeSent', {
      requestId: 'req-1',
      request: { url: 'https://example.com', method: 'GET' },
    });

    const statusBeforeDisconnect = await service.callTool('getRecordingStatus', {});
    expect(statusBeforeDisconnect).toMatchObject({
      recording: {
        requestCount: 1,
        generation: 1,
      },
    });

    service.onDisconnected();

    const statusAfterDisconnect = await service.callTool('getRecordingStatus', {});
    expect(statusAfterDisconnect).toMatchObject({
      recording: {
        isRecording: false,
        requestCount: 0,
        generation: 2,
      },
    });

    const listResult = (await service.callTool('listRequests', {})) as {
      items: unknown[];
    };
    expect(listResult.items).toEqual([]);
  });

  it('signals page.reset instead of silently-empty items for a cursor from before a disconnect', async () => {
    const listeners = new Map<
      string,
      Set<(params: Record<string, unknown>) => void | Promise<void>>
    >();

    const subscribeToCDPEvent = (
      method: string,
      listener: (params: Record<string, unknown>) => void | Promise<void>,
    ) => {
      const entries = listeners.get(method) || new Set();
      entries.add(listener);
      listeners.set(method, entries);

      return () => {
        entries.delete(listener);
        if (entries.size === 0) {
          listeners.delete(method);
        }
      };
    };

    const emit = (method: string, params: Record<string, unknown>) => {
      for (const listener of listeners.get(method) || []) {
        void listener(params);
      }
    };

    const service = createNetworkDomainService({
      getSessionInfo: () => ({
        sessionId: 'device-1',
        pageId: 'page-1',
        deviceId: 'device-1',
      }),
      sendCommand: async () => ({}),
      subscribeToCDPEvent,
    });

    await service.callTool('startRecording', {});
    emit('Network.requestWillBeSent', {
      requestId: 'req-1',
      request: { url: 'https://example.com/one', method: 'GET' },
    });
    emit('Network.requestWillBeSent', {
      requestId: 'req-2',
      request: { url: 'https://example.com/two', method: 'GET' },
    });

    const firstPage = (await service.callTool('listRequests', {
      limit: 1,
    })) as {
      items: unknown[];
      page: { hasMore: boolean; nextCursor?: string; reset?: boolean };
    };
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.page.hasMore).toBe(true);
    expect(firstPage.page.nextCursor).toBeTruthy();
    expect(firstPage.page.reset).toBeUndefined();

    // An app relaunch (or any disconnect) wipes the capture buffer and bumps
    // the generation, so the cursor issued above now points at a buffer
    // that no longer exists.
    service.onDisconnected();

    const staleContinuation = (await service.callTool('listRequests', {
      cursor: firstPage.page.nextCursor,
    })) as {
      items: unknown[];
      page: { hasMore: boolean; nextCursor?: string; reset?: boolean };
    };
    expect(staleContinuation.items).toEqual([]);
    expect(staleContinuation.page.hasMore).toBe(false);
    expect(staleContinuation.page.reset).toBe(true);
  });
});
