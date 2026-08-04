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

const createStoreWithComponent = () => {
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
        childIds: [3],
      },
      {
        nodeId: 3,
        displayName: 'Button',
        elementType: 'host',
        parentId: 2,
        childIds: [],
      },
    ],
  });

  return { store, sent };
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

describe('React tree store', () => {
  it('returns the current React tree in traversal order', () => {
    const store = createStoreWithTree();

    expect(store.getTree(DEVICE_ID, {})).toMatchObject({
      roots: [1],
      totalCount: 4,
      items: [
        {
          nodeId: 1,
          displayName: 'Root',
          elementType: 'root',
          childIds: [2, 3],
          childCount: 2,
          depth: 0,
        },
        {
          nodeId: 2,
          displayName: 'App',
          elementType: 'function',
          parentId: 1,
          childIds: [4],
          childCount: 1,
          depth: 1,
        },
        {
          nodeId: 4,
          displayName: 'Button',
          elementType: 'host',
          parentId: 2,
          childIds: [],
          childCount: 0,
          depth: 2,
        },
        {
          nodeId: 3,
          displayName: 'Sidebar',
          elementType: 'function',
          parentId: 1,
          childIds: [],
          childCount: 0,
          depth: 1,
        },
      ],
      page: {
        limit: 20,
        hasMore: false,
      },
    });
  });

  it('limits tree traversal by depth', () => {
    const store = createStoreWithTree();

    const result = store.getTree(DEVICE_ID, { depth: 1 });

    expect(result.totalCount).toBe(3);
    expect(result.items.map((item) => item.nodeId)).toEqual([1, 2, 3]);
    expect(result.items.map((item) => item.depth)).toEqual([0, 1, 1]);
  });

  it('returns a subtree scoped to a root node', () => {
    const store = createStoreWithTree();

    const result = store.getTree(DEVICE_ID, { root: 2 });

    expect(result.roots).toEqual([2]);
    expect(result.totalCount).toBe(2);
    expect(result.items.map((item) => item.nodeId)).toEqual([2, 4]);
    expect(result.items.map((item) => item.depth)).toEqual([0, 1]);
  });

  it('paginates tree results with stable cursors', () => {
    const store = createStoreWithTree();

    const firstPage = store.getTree(DEVICE_ID, { limit: 2 });

    expect(firstPage.items.map((item) => item.nodeId)).toEqual([1, 2]);
    expect(firstPage.page.hasMore).toBe(true);
    expect(firstPage.page.nextCursor).toEqual(expect.any(String));

    const secondPage = store.getTree(DEVICE_ID, {
      limit: 2,
      cursor: firstPage.page.nextCursor,
    });

    expect(secondPage.items.map((item) => item.nodeId)).toEqual([4, 3]);
    expect(secondPage.page.hasMore).toBe(false);
  });

  it('rejects cursors from a different tree request', () => {
    const store = createStoreWithTree();
    const firstPage = store.getTree(DEVICE_ID, { limit: 1 });

    expect(() =>
      store.getTree(DEVICE_ID, {
        depth: 1,
        cursor: firstPage.page.nextCursor,
      }),
    ).toThrow('Cursor does not match this request context');
  });
});

describe('React tree store labels', () => {
  it('adds deterministic labels to node summaries', () => {
    const store = createStoreWithTree();

    const result = store.searchNodes(DEVICE_ID, { query: 'o', limit: 10 });

    expect(result.items).toEqual([
      expect.objectContaining({
        nodeId: 1,
        label: '@c1',
        displayName: 'Root',
      }),
      expect.objectContaining({
        nodeId: 4,
        label: '@c3',
        parentLabel: '@c2',
        displayName: 'Button',
      }),
    ]);
    expect(store.getNode(DEVICE_ID, { id: '@c4' })).toMatchObject({
      nodeId: 3,
      label: '@c4',
      parentLabel: '@c1',
      displayName: 'Sidebar',
    });
  });

  it('resolves labels for node lookup', () => {
    const store = createStoreWithTree();

    expect(store.getNode(DEVICE_ID, { id: '@c2' })).toMatchObject({
      nodeId: 2,
      label: '@c2',
      displayName: 'App',
      parentLabel: '@c1',
    });
  });

  it('keeps numeric nodeId lookup working', () => {
    const store = createStoreWithTree();

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

    expect(store.getChildren(DEVICE_ID, { id: '@c1' }).items).toEqual([
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

  it('rejects stale labels after a tree sync', () => {
    const store = createStoreWithTree();
    expect(store.getNode(DEVICE_ID, { id: '@c4' }).nodeId).toBe(3);

    store.syncTree(DEVICE_ID, {
      roots: [1],
      nodes: [
        {
          nodeId: 1,
          displayName: 'Root',
          elementType: 'root',
          childIds: [],
        },
      ],
    });

    expect(() => store.getNode(DEVICE_ID, { id: '@c4' })).toThrow(
      'Component label "@c4" no longer exists in the current React tree.',
    );
  });
});

describe('React tree store getComponent', () => {
  it('returns a node summary with inspected props, state, and hooks', async () => {
    const { store, sent } = createStoreWithComponent();

    const resultPromise = store.getComponent(DEVICE_ID, { id: 2 });
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
          state: { count: 1 },
          hooks: [{ name: 'State', value: 'ready' }],
        },
      },
    });

    await expect(resultPromise).resolves.toMatchObject({
      node: {
        nodeId: 2,
        label: '@c2',
        parentLabel: '@c1',
        displayName: 'App',
        elementType: 'function',
        childIds: [3],
        rendererId: 7,
      },
      props: { title: 'Hello' },
      state: { count: 1 },
      hooks: [{ name: 'State', value: 'ready' }],
    });
  });

  it('returns only requested sections', async () => {
    const { store, sent } = createStoreWithComponent();

    const resultPromise = store.getComponent(DEVICE_ID, {
      nodeId: 2,
      include: ['props'],
    });
    await waitFor(() => sent.length > 0);
    await store.ingestReactDevToolsMessage(DEVICE_ID, {
      event: 'inspectedElement',
      payload: {
        id: 2,
        type: 'full-data',
        value: {
          props: { title: 'Hello' },
          state: { count: 1 },
          hooks: [{ name: 'State', value: 'ready' }],
        },
      },
    });

    await expect(resultPromise).resolves.toEqual(
      expect.not.objectContaining({
        state: expect.anything(),
        hooks: expect.anything(),
      }),
    );
    await expect(resultPromise).resolves.toMatchObject({
      props: { title: 'Hello' },
    });
  });

  it('marks the response partial when requested sections are unavailable', async () => {
    const { store, sent } = createStoreWithComponent();

    const resultPromise = store.getComponent(DEVICE_ID, { id: 2 });
    await waitFor(() => sent.length > 0);
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

    await expect(resultPromise).resolves.toMatchObject({
      props: { title: 'Hello' },
      partial: true,
      unavailable: ['state', 'hooks'],
    });
  });

  it('bounds serialized nested values', async () => {
    const { store, sent } = createStoreWithComponent();

    const resultPromise = store.getComponent(DEVICE_ID, {
      id: 2,
      include: ['props'],
      valueDepth: 1,
    });
    await waitFor(() => sent.length > 0);
    await store.ingestReactDevToolsMessage(DEVICE_ID, {
      event: 'inspectedElement',
      payload: {
        id: 2,
        type: 'full-data',
        value: {
          props: {
            nested: {
              value: 'hidden',
            },
            onPress: () => undefined,
          },
        },
      },
    });

    await expect(resultPromise).resolves.toMatchObject({
      props: {
        nested: '[object]',
        onPress: '[function]',
      },
    });
  });

  it('throws when React DevTools returns no inspected data', async () => {
    const { store, sent } = createStoreWithComponent();

    const resultPromise = store.getComponent(DEVICE_ID, { id: 2 });
    await waitFor(() => sent.length > 0);
    await store.ingestReactDevToolsMessage(DEVICE_ID, {
      event: 'inspectedElement',
      payload: {
        id: 2,
        type: 'not-found',
      },
    });

    await expect(resultPromise).rejects.toThrow(
      'No inspected snapshot available for node "2".',
    );
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

    const result = await store.stopProfiling(DEVICE_ID, { waitForDataMs: 200 });

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
