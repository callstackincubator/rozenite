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
