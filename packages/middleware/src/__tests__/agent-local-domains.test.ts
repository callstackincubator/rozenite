import { describe, expect, it, vi } from 'vitest';
import { createMemoryDomainService } from '../agent/local-domains.js';

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
      relativePath:
        '.rozenite/agent/sessions/device-1/memory/snapshot.heapsnapshot',
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
        relativePath:
          '.rozenite/agent/sessions/device-1/memory/snapshot.heapsnapshot',
        fileName: 'snapshot.heapsnapshot',
        bucket: 'memory',
        write,
        finalize,
        abort,
      }),
    });

    let settled = false;
    const resultPromise = service
      .callTool('takeHeapSnapshot', {})
      .finally(() => {
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
