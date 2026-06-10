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

