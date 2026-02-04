import { describe, expect, it, vi } from 'vitest';
import { createReactDomainService } from '../commands/agent/local-domains.js';

const createInitialOperationsPayload = (): number[] => {
  return [
    7,
    1,
    10,
    3, 65, 112, 112,
    5, 67, 104, 105, 108, 100,
    1, 1, 11, 0, 0, 0, 0,
    1, 2, 5, 1, 0, 2, 0,
  ];
};

describe('react domain profiling', () => {
  it('collects profiling data after runtime stop confirmation', async () => {
    const sent: Array<{ event: string; payload: unknown }> = [];
    let service!: ReturnType<typeof createReactDomainService>;

    service = createReactDomainService({
      sessionId: 'session-1',
      sendReactDevToolsMessage: (message) => {
        const typedMessage = message as { event: string; payload: Record<string, unknown> | undefined };
        sent.push({
          event: typedMessage.event,
          payload: typedMessage.payload,
        });

        if (typedMessage.event === 'startProfiling') {
          queueMicrotask(() => {
            void service.captureReactDevToolsMessage?.({
              event: 'profilingStatus',
              payload: true,
            });
          });
        }

        if (typedMessage.event === 'stopProfiling') {
          queueMicrotask(() => {
            void service.captureReactDevToolsMessage?.({
              event: 'profilingStatus',
              payload: false,
            });
          });
        }

        if (typedMessage.event === 'getProfilingData') {
          const rendererID = Number(typedMessage.payload?.rendererID);
          queueMicrotask(() => {
            void service.captureReactDevToolsMessage?.({
              event: 'profilingData',
              payload: {
                rendererID,
                dataForRoots: [{
                  rootID: 1,
                  commitData: [{
                    changeDescriptions: [[2, {
                      context: null,
                      didHooksChange: true,
                      isFirstMount: false,
                      props: ['query'],
                      state: ['results'],
                    }]],
                    duration: 24,
                    effectDuration: 5,
                    fiberActualDurations: [[2, 24]],
                    fiberSelfDurations: [[2, 11]],
                    passiveEffectDuration: null,
                    priorityLevel: 'normal',
                    timestamp: 100,
                    updaters: [{ id: 2 }],
                  }],
                }],
              },
            });
          });
        }
      },
    });

    await service.captureReactDevToolsMessage?.({
      event: 'operations',
      payload: createInitialOperationsPayload(),
    });

    const start = await service.callTool('startProfiling', {}) as {
      ok: boolean;
      status: { isProfilingStarted: boolean; isProcessingData: boolean };
    };
    expect(start.ok).toBe(true);
    expect(start.status).toEqual({
      isProfilingStarted: true,
      isProcessingData: false,
    });

    await vi.waitFor(async () => {
      const status = await service.callTool('isProfilingStarted', {}) as {
        isProfilingStarted: boolean;
      };
      expect(status.isProfilingStarted).toBe(true);
    });

    await service.captureReactDevToolsMessage?.({
      event: 'operations',
      payload: createInitialOperationsPayload(),
    });

    const stopped = await service.callTool('stopProfiling', {
      waitForDataMs: 1000,
      slowRenderThresholdMs: 16,
    }) as {
      partial?: boolean;
      session: { roots: number[]; totalCommits: number; totalRenderDurationMs: number };
      renders: { count: number; slowCount: number };
      topSlowCommits: Array<{ rootId: number; commitIndex: number; durationMs: number }>;
    };

    expect(stopped.partial).toBeUndefined();
    expect(stopped.session).toEqual({
      roots: [1],
      totalCommits: 1,
      totalRenderDurationMs: 24,
    });
    expect(stopped.renders).toMatchObject({
      count: 1,
      slowCount: 1,
    });
    expect(stopped.topSlowCommits).toEqual([{
      rootId: 1,
      commitIndex: 0,
      durationMs: 24,
      timestampMs: 100,
    }]);

    const renderData = await service.callTool('getRenderData', {
      rootId: 1,
      commitIndex: 0,
    }) as {
      commit: { durationMs: number; priorityLevel: string | null };
      summary: { renderedFiberCount: number; slowFiberCount: number; updaterCount: number };
      items: Array<{ fiberId: number; isSlow: boolean; changeTypeHints?: string[] }>;
    };

    expect(renderData.commit).toMatchObject({
      durationMs: 24,
      priorityLevel: 'normal',
    });
    expect(renderData.summary).toMatchObject({
      renderedFiberCount: 1,
      slowFiberCount: 1,
      updaterCount: 1,
    });
    expect(renderData.items).toEqual([{
      fiberId: 2,
      actualDurationMs: 24,
      selfDurationMs: 11,
      isSlow: true,
      changeTypeHints: ['props', 'state', 'hooks'],
    }]);

    expect(sent.map((message) => message.event)).toEqual([
      'startProfiling',
      'stopProfiling',
      'getProfilingData',
    ]);
  });

  it('returns a partial result when no profiling payload arrives before timeout', async () => {
    let service!: ReturnType<typeof createReactDomainService>;

    service = createReactDomainService({
      sessionId: 'session-1',
      sendReactDevToolsMessage: (message) => {
        const typedMessage = message as { event: string };
        if (typedMessage.event === 'startProfiling') {
          queueMicrotask(() => {
            void service.captureReactDevToolsMessage?.({
              event: 'profilingStatus',
              payload: true,
            });
          });
        }

        if (typedMessage.event === 'stopProfiling') {
          queueMicrotask(() => {
            void service.captureReactDevToolsMessage?.({
              event: 'profilingStatus',
              payload: false,
            });
          });
        }
      },
    });

    await service.captureReactDevToolsMessage?.({
      event: 'operations',
      payload: createInitialOperationsPayload(),
    });
    await service.callTool('startProfiling', {});

    await vi.waitFor(async () => {
      const status = await service.callTool('isProfilingStarted', {}) as {
        isProfilingStarted: boolean;
      };
      expect(status.isProfilingStarted).toBe(true);
    });

    await service.captureReactDevToolsMessage?.({
      event: 'operations',
      payload: createInitialOperationsPayload(),
    });

    const stopped = await service.callTool('stopProfiling', {
      waitForDataMs: 50,
    }) as {
      partial?: boolean;
      session: { totalCommits: number };
      topSlowCommits: unknown[];
    };

    expect(stopped.partial).toBe(true);
    expect(stopped.session.totalCommits).toBe(0);
    expect(stopped.topSlowCommits).toEqual([]);
  });

  it('marks the session partial when different renderers report the same root id', async () => {
    let service!: ReturnType<typeof createReactDomainService>;

    service = createReactDomainService({
      sessionId: 'session-1',
      sendReactDevToolsMessage: (message) => {
        const typedMessage = message as { event: string; payload: Record<string, unknown> | undefined };
        if (typedMessage.event === 'startProfiling') {
          queueMicrotask(() => {
            void service.captureReactDevToolsMessage?.({
              event: 'profilingStatus',
              payload: true,
            });
          });
        }

        if (typedMessage.event === 'stopProfiling') {
          queueMicrotask(() => {
            void service.captureReactDevToolsMessage?.({
              event: 'profilingStatus',
              payload: false,
            });
          });
        }

        if (typedMessage.event === 'getProfilingData') {
          const rendererID = Number(typedMessage.payload?.rendererID);
          queueMicrotask(() => {
            void service.captureReactDevToolsMessage?.({
              event: 'profilingData',
              payload: {
                rendererID,
                dataForRoots: [{
                  rootID: 1,
                  commitData: [{
                    duration: rendererID === 7 ? 24 : 12,
                    timestamp: rendererID === 7 ? 100 : 120,
                    fiberActualDurations: [[2, rendererID === 7 ? 24 : 12]],
                    fiberSelfDurations: [[2, 11]],
                  }],
                }],
              },
            });
          });
        }
      },
    });

    await service.captureReactDevToolsMessage?.({
      event: 'rendererAttached',
      payload: { id: 8 },
    });
    await service.captureReactDevToolsMessage?.({
      event: 'operations',
      payload: createInitialOperationsPayload(),
    });

    await service.callTool('startProfiling', {});
    await vi.waitFor(async () => {
      const status = await service.callTool('isProfilingStarted', {}) as {
        isProfilingStarted: boolean;
      };
      expect(status.isProfilingStarted).toBe(true);
    });

    await service.captureReactDevToolsMessage?.({
      event: 'operations',
      payload: createInitialOperationsPayload(),
    });
    await service.captureReactDevToolsMessage?.({
      event: 'operations',
      payload: [8, 1, 0],
    });

    const stopped = await service.callTool('stopProfiling', {
      waitForDataMs: 1000,
    }) as {
      partial?: boolean;
      session: { roots: number[]; totalCommits: number };
    };

    expect(stopped.partial).toBe(true);
    expect(stopped.session.roots).toEqual([1]);
    expect(stopped.session.totalCommits).toBe(1);

    await expect(service.callTool('getRenderData', {
      rootId: 1,
      commitIndex: 0,
    })).rejects.toThrow(
      'Commit data for root "1" is ambiguous across multiple React renderers.',
    );
  });
});
