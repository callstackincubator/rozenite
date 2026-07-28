import { describe, expect, it } from 'vitest';
import { createReactTreeStore } from '../store.js';

const DEVICE_ID = 'device-1';

const waitFor = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }

  expect(predicate()).toBe(true);
};

const createStoreWithBridgeStub = (
  sent: Array<{ event: string; payload: unknown }>,
) => {
  return createReactTreeStore({
    createBridge: async (options) => ({
      ingest: () => null,
      send: (event, payload) => {
        sent.push({ event, payload });
        options?.sendMessage?.({ event, payload });
      },
      startProfiling: () => undefined,
      stopProfiling: () => undefined,
      reloadAndProfile: () => undefined,
      getProfilingStatus: () => ({
        supportsProfiling: true,
        supportsReloadAndProfile: false,
        isProfilingStarted: false,
        isProcessingData: false,
        hasProfilingData: false,
        rootsWithData: 0,
        rootsCount: 0,
      }),
      getProfilingDataSnapshot: () => null,
      getCommitData: () => {
        throw new Error('No commit data');
      },
    }),
  });
};

const createStoreWithTree = () => {
  const store = createReactTreeStore();
  store.registerDevice(DEVICE_ID);
  store.syncTree(DEVICE_ID, {
    roots: [1],
    nodes: [
      {
        nodeId: 1,
        displayName: 'Root',
        elementType: 'root',
        childIds: [2, 3],
      },
      {
        nodeId: 2,
        displayName: 'App',
        elementType: 'function',
        parentId: 1,
        childIds: [4],
      },
      {
        nodeId: 3,
        displayName: 'Sidebar',
        elementType: 'function',
        parentId: 1,
        childIds: [],
      },
      {
        nodeId: 4,
        displayName: 'Button',
        elementType: 'host',
        parentId: 2,
        childIds: [],
      },
    ],
  });

  return store;
};

describe('CLI React tree store labels', () => {
  it('resolves labels for node lookup while keeping numeric nodeId lookup working', () => {
    const store = createStoreWithTree();

    expect(store.getNode(DEVICE_ID, { id: '@c2' })).toMatchObject({
      nodeId: 2,
      label: '@c2',
      displayName: 'App',
      parentLabel: '@c1',
    });
    expect(store.getNode(DEVICE_ID, { nodeId: 2 })).toMatchObject({
      nodeId: 2,
      label: '@c2',
      displayName: 'App',
    });
  });

  it('resolves labels for children and inspectable requests', async () => {
    const sent: Array<{ event: string; payload: unknown }> = [];
    const store = createStoreWithBridgeStub(sent);
    store.registerDevice(DEVICE_ID, {
      sendMessage: () => undefined,
    });
    store.syncTree(DEVICE_ID, {
      roots: [1],
      nodes: [
        {
          nodeId: 1,
          displayName: 'Root',
          elementType: 'root',
          childIds: [2],
        },
        {
          nodeId: 2,
          displayName: 'App',
          elementType: 'function',
          parentId: 1,
          rendererId: 7,
          childIds: [],
        },
      ],
    });

    expect(store.getChildren(DEVICE_ID, { id: '@c1', limit: 3 }).items).toEqual([
      expect.objectContaining({
        nodeId: 2,
        label: '@c2',
        parentLabel: '@c1',
      }),
    ]);

    const propsPromise = store.getProps(DEVICE_ID, { id: '@c2' });
    await waitFor(() => sent.length > 0);

    expect(sent.at(-1)).toEqual({
      event: 'inspectElement',
      payload: {
        forceFullData: true,
        id: 2,
        path: null,
        rendererID: 7,
        requestID: 1,
      },
    });

    await store.ingestReactDevToolsMessage(DEVICE_ID, {
      event: 'inspectedElement',
      payload: {
        id: 2,
        type: 'full-data',
        value: {
          props: { title: 'Hello' },
        },
      },
    });

    await expect(propsPromise).resolves.toMatchObject({
      items: [{ name: 'title', value: 'Hello' }],
    });
  });
});

type MockPhase = 'idle' | 'profiling' | 'processing';

const createConfigurableProfilingBridge = (options: {
  initialPhase?: MockPhase;
  initialDataForRoots?: Map<
    number,
    { commitData: Array<{ duration: number; timestamp: number }> }
  >;
  drainAfterStatusCalls?: number;
  dataOnDrain?: Map<
    number,
    { commitData: Array<{ duration: number; timestamp: number }> }
  >;
}) => {
  let phase: MockPhase = options.initialPhase ?? 'idle';
  let dataForRoots = options.initialDataForRoots ?? new Map();
  let statusCallCount = 0;

  return {
    ingest: () => null,
    send: () => undefined,
    startProfiling: () => {
      phase = 'profiling';
    },
    stopProfiling: () => {
      phase = 'idle';
    },
    reloadAndProfile: () => undefined,
    getProfilingStatus: () => {
      statusCallCount += 1;
      if (
        phase === 'processing' &&
        options.drainAfterStatusCalls !== undefined &&
        statusCallCount > options.drainAfterStatusCalls
      ) {
        phase = 'idle';
        if (options.dataOnDrain) {
          dataForRoots = options.dataOnDrain;
        }
      }

      return {
        supportsProfiling: true,
        supportsReloadAndProfile: false,
        isProfilingStarted: phase === 'profiling',
        isProcessingData: phase === 'processing',
        hasProfilingData: dataForRoots.size > 0,
        rootsWithData: dataForRoots.size,
        rootsCount: dataForRoots.size,
      };
    },
    getProfilingDataSnapshot: () => ({
      phase,
      dataForRoots,
      conflictingRootIds: new Set<number>(),
      participatingRendererIds: new Set([1]),
      pendingRendererIds: new Set<number>(),
      receivedRendererIds: new Set([1]),
    }),
    getCommitData: () => {
      throw new Error('No commit data');
    },
  };
};

describe('React stopProfiling guard', () => {
  it('throws when stopProfiling is called with no active session', async () => {
    const bridge = createConfigurableProfilingBridge({ initialPhase: 'idle' });
    const store = createReactTreeStore({
      createBridge: async () => bridge,
    });
    store.registerDevice(DEVICE_ID, { sendMessage: () => undefined });

    await expect(store.stopProfiling(DEVICE_ID, {})).rejects.toThrow(
      'No active profiling session for this session',
    );
  });

  it('still collects data when profiling self-stopped and is still draining', async () => {
    const dataOnDrain = new Map([
      [1, { commitData: [{ duration: 5, timestamp: 100 }] }],
    ]);
    const bridge = createConfigurableProfilingBridge({
      initialPhase: 'processing',
      drainAfterStatusCalls: 2,
      dataOnDrain,
    });
    const store = createReactTreeStore({
      createBridge: async () => bridge,
    });
    store.registerDevice(DEVICE_ID, { sendMessage: () => undefined });

    const result = await store.stopProfiling(DEVICE_ID, {
      waitForDataMs: 200,
    });

    expect(result).toMatchObject({
      session: { totalCommits: 1 },
      renders: { count: 1 },
    });
    expect(result).not.toHaveProperty('partial');
  });

  it('returns already-collected data for an already-complete session', async () => {
    const initialDataForRoots = new Map([
      [1, { commitData: [{ duration: 8, timestamp: 200 }] }],
    ]);
    const bridge = createConfigurableProfilingBridge({
      initialPhase: 'idle',
      initialDataForRoots,
    });
    const store = createReactTreeStore({
      createBridge: async () => bridge,
    });
    store.registerDevice(DEVICE_ID, { sendMessage: () => undefined });

    const result = await store.stopProfiling(DEVICE_ID, {});

    expect(result).toMatchObject({
      session: { totalCommits: 1 },
      renders: { count: 1 },
    });
  });

  it('returns a real zero-commit measurement after start then stop with no re-renders', async () => {
    const bridge = createConfigurableProfilingBridge({ initialPhase: 'idle' });
    const store = createReactTreeStore({
      createBridge: async () => bridge,
    });
    store.registerDevice(DEVICE_ID, { sendMessage: () => undefined });

    await store.startProfiling(DEVICE_ID, {});
    const result = await store.stopProfiling(DEVICE_ID, {});

    expect(result).toMatchObject({
      session: { totalCommits: 0 },
      renders: { count: 0 },
    });
  });
});
