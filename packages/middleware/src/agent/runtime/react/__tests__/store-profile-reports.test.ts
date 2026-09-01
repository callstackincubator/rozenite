import { describe, expect, it } from 'vitest';
import { createReactTreeStore } from '../store.js';
import type { ReactRootProfilingData } from '../profiling-store.js';
import {
  createBridgeStub,
  createChangeDescription,
  createCommit,
  createProfilingBridgeStub,
  createProfilingSnapshot,
} from './bridge-stub.js';

const DEVICE_ID = 'device-profile';

/**
 * Root 1, three commits:
 *   0 — List 10ms / Row 4ms, both first mount
 *   1 — List 30ms (props: items) / Row 2ms (props: onPress)
 *   2 — Row 1ms (state: open)
 * Root 2, one commit: fiber 2 again, a different component in another renderer.
 */
const createSession = (): Map<number, ReactRootProfilingData> =>
  new Map([
    [
      1,
      {
        commitData: [
          createCommit({
            duration: 14,
            timestamp: 100,
            fiberActualDurations: new Map([
              [2, 10],
              [3, 4],
            ]),
            fiberSelfDurations: new Map([
              [2, 6],
              [3, 4],
            ]),
            changeDescriptions: new Map([
              [2, createChangeDescription({ isFirstMount: true })],
              [3, createChangeDescription({ isFirstMount: true })],
            ]),
          }),
          createCommit({
            duration: 32,
            timestamp: 200,
            fiberActualDurations: new Map([
              [2, 30],
              [3, 2],
            ]),
            fiberSelfDurations: new Map([
              [2, 28],
              [3, 2],
            ]),
            changeDescriptions: new Map([
              [2, createChangeDescription({ props: ['items'] })],
              [3, createChangeDescription({ props: ['onPress'] })],
            ]),
          }),
          createCommit({
            duration: 1,
            timestamp: 300,
            fiberActualDurations: new Map([[3, 1]]),
            fiberSelfDurations: new Map([[3, 1]]),
            changeDescriptions: new Map([[3, createChangeDescription({ state: ['open'] })]]),
          }),
        ],
      },
    ],
    [
      2,
      {
        commitData: [
          createCommit({
            duration: 5,
            timestamp: 400,
            fiberActualDurations: new Map([[2, 5]]),
            fiberSelfDurations: new Map([[2, 5]]),
          }),
        ],
      },
    ],
  ]);

const createStore = (dataForRoots = createSession()) => {
  const store = createReactTreeStore({
    createBridge: async () => createProfilingBridgeStub(dataForRoots),
  });
  store.registerDevice(DEVICE_ID, { sendMessage: () => undefined });
  store.syncTree(DEVICE_ID, {
    roots: [1],
    nodes: [
      { nodeId: 1, displayName: 'Root', elementType: 'root', childIds: [2] },
      { nodeId: 2, displayName: 'List', elementType: 'function', parentId: 1, childIds: [3] },
      { nodeId: 3, displayName: 'Row', elementType: 'function', parentId: 2, childIds: [] },
    ],
  });

  return store;
};

describe('React getComponentRenders', () => {
  it('aggregates every commit into one row per component, slowest total first', async () => {
    const result = await createStore().getComponentRenders(DEVICE_ID, { rootId: 1 });

    expect(result.items).toEqual([
      expect.objectContaining({
        rootId: 1,
        fiberId: 2,
        label: '@c2',
        displayName: 'List',
        renderCount: 2,
        totalDurationMs: 40,
        avgDurationMs: 20,
        maxDurationMs: 30,
        totalSelfDurationMs: 34,
        // Only the 30ms commit clears the 16ms default threshold.
        slowRenderCount: 1,
        slowestCommitIndex: 1,
      }),
      expect.objectContaining({
        fiberId: 3,
        displayName: 'Row',
        renderCount: 3,
        totalDurationMs: 7,
        maxDurationMs: 4,
        slowRenderCount: 0,
        slowestCommitIndex: 0,
      }),
    ]);
    expect(result.summary).toMatchObject({
      roots: [1],
      totalCommits: 3,
      renderedFiberCount: 2,
      hasChangeDescriptions: true,
    });
  });

  it('unions the render causes and changed keys across commits', async () => {
    const result = await createStore().getComponentRenders(DEVICE_ID, { rootId: 1 });

    expect(result.items[1]).toMatchObject({
      fiberId: 3,
      changeTypeHints: ['mount', 'props', 'state'],
      changedKeys: { isFirstMount: true, props: ['onPress'], state: ['open'] },
    });
  });

  it('sorts by render count when asked', async () => {
    const result = await createStore().getComponentRenders(DEVICE_ID, {
      rootId: 1,
      sort: 'render-count-desc',
    });

    expect(result.items.map((item) => item.fiberId)).toEqual([3, 2]);
  });

  it('reports a single component when given a label', async () => {
    const result = await createStore().getComponentRenders(DEVICE_ID, { id: '@c2', rootId: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ fiberId: 2, renderCount: 2 });
  });

  it('keeps fibers of different roots apart even when their IDs collide', async () => {
    const result = await createStore().getComponentRenders(DEVICE_ID, {});

    // Fiber 2 exists under both roots; merging on ID alone would invent one
    // component with three renders.
    const fiberTwoRows = result.items.filter((item) => item.fiberId === 2);
    expect(fiberTwoRows.map((item) => [item.rootId, item.renderCount])).toEqual([
      [1, 2],
      [2, 1],
    ]);
    expect(result.summary.roots).toEqual([1, 2]);
  });

  it('falls back to a fiber ID for a component that unmounted before the read', async () => {
    const store = createStore(
      new Map([
        [
          1,
          {
            commitData: [
              createCommit({
                duration: 3,
                fiberActualDurations: new Map([[99, 3]]),
              }),
            ],
          },
        ],
      ]),
    );

    const result = await store.getComponentRenders(DEVICE_ID, {});

    expect(result.items[0]).toMatchObject({ fiberId: 99, displayName: 'Fiber 99' });
    expect(result.items[0]).not.toHaveProperty('label');
  });

  it('rejects an unknown sort', async () => {
    await expect(createStore().getComponentRenders(DEVICE_ID, { sort: 'nope' })).rejects.toThrow(
      '"sort" must be one of',
    );
  });
});

describe('React getProfileTimeline', () => {
  it('lists commits chronologically across roots', async () => {
    const result = await createStore().getProfileTimeline(DEVICE_ID, {});

    expect(result.items).toEqual([
      {
        rootId: 1,
        commitIndex: 0,
        durationMs: 14,
        timestampMs: 100,
        renderedFiberCount: 2,
        isSlow: false,
        effectDurationMs: null,
        passiveEffectDurationMs: null,
        priorityLevel: null,
        updaterCount: 0,
        hasChangeDescriptions: true,
      },
      {
        rootId: 1,
        commitIndex: 1,
        durationMs: 32,
        timestampMs: 200,
        renderedFiberCount: 2,
        isSlow: true,
        effectDurationMs: null,
        passiveEffectDurationMs: null,
        priorityLevel: null,
        updaterCount: 0,
        hasChangeDescriptions: true,
      },
      {
        rootId: 1,
        commitIndex: 2,
        durationMs: 1,
        timestampMs: 300,
        renderedFiberCount: 1,
        isSlow: false,
        effectDurationMs: null,
        passiveEffectDurationMs: null,
        priorityLevel: null,
        updaterCount: 0,
        hasChangeDescriptions: true,
      },
      {
        rootId: 2,
        commitIndex: 0,
        durationMs: 5,
        timestampMs: 400,
        renderedFiberCount: 1,
        isSlow: false,
        effectDurationMs: null,
        passiveEffectDurationMs: null,
        priorityLevel: null,
        updaterCount: 0,
        hasChangeDescriptions: false,
      },
    ]);
    expect(result.summary).toEqual({
      roots: [1, 2],
      totalCommits: 4,
      totalRenderDurationMs: 52,
      slowCommitCount: 1,
      slowRenderThresholdMs: 16,
    });
  });

  it('reports commit cost beyond render time', async () => {
    const store = createStore(
      new Map([
        [
          1,
          {
            commitData: [
              createCommit({
                duration: 4,
                timestamp: 100,
                effectDuration: 21,
                passiveEffectDuration: 9.5,
                priorityLevel: 'Normal',
                updaters: [{ id: 2 }, { id: 3 }],
                fiberActualDurations: new Map([[2, 4]]),
                fiberSelfDurations: new Map([[2, 4]]),
              }),
            ],
          },
        ],
      ]),
    );

    const result = await store.getProfileTimeline(DEVICE_ID, {});

    // A commit that renders in 4ms but spends 21ms in layout effects is not
    // slow by render duration, and only these fields say so.
    expect(result.items).toEqual([
      {
        rootId: 1,
        commitIndex: 0,
        durationMs: 4,
        timestampMs: 100,
        renderedFiberCount: 1,
        isSlow: false,
        effectDurationMs: 21,
        passiveEffectDurationMs: 9.5,
        priorityLevel: 'Normal',
        updaterCount: 2,
        hasChangeDescriptions: false,
      },
    ]);
  });

  it('sorts by duration and paginates', async () => {
    const store = createStore();
    const firstPage = await store.getProfileTimeline(DEVICE_ID, {
      sort: 'duration-desc',
      limit: 2,
    });

    expect(firstPage.items.map((item) => item.durationMs)).toEqual([32, 14]);
    expect(firstPage.totalCount).toBe(4);

    const secondPage = await store.getProfileTimeline(DEVICE_ID, {
      sort: 'duration-desc',
      limit: 2,
      cursor: firstPage.page.nextCursor,
    });

    expect(secondPage.items.map((item) => item.durationMs)).toEqual([5, 1]);
    expect(secondPage.page.hasMore).toBe(false);
  });

  it('scopes to one root', async () => {
    const result = await createStore().getProfileTimeline(DEVICE_ID, { rootId: 2 });

    expect(result.items).toHaveLength(1);
    expect(result.summary.roots).toEqual([2]);
  });

  it('honours a custom slow threshold', async () => {
    const result = await createStore().getProfileTimeline(DEVICE_ID, {
      slowRenderThresholdMs: 4,
    });

    expect(result.summary.slowCommitCount).toBe(3);
  });

  it('rejects a cursor issued under a different sort', async () => {
    const store = createStore();
    const firstPage = await store.getProfileTimeline(DEVICE_ID, { limit: 2 });

    await expect(
      store.getProfileTimeline(DEVICE_ID, {
        sort: 'duration-desc',
        limit: 2,
        cursor: firstPage.page.nextCursor,
      }),
    ).rejects.toThrow('Cursor does not match this request context');
  });
});

describe('React profiling aggregates without data', () => {
  const createEmptyStore = (bridge = createBridgeStub()) => {
    const store = createReactTreeStore({ createBridge: async () => bridge });
    store.registerDevice(DEVICE_ID, { sendMessage: () => undefined });
    return store;
  };

  it('explains how to capture a session when none exists', async () => {
    const store = createEmptyStore();

    await expect(store.getComponentRenders(DEVICE_ID, {})).rejects.toThrow(
      'No React profiling data available. Run startProfiling and stopProfiling first.',
    );
    await expect(store.getProfileTimeline(DEVICE_ID, {})).rejects.toThrow(
      'No React profiling data available',
    );
  });

  it('reports an unknown root rather than an empty session', async () => {
    const store = createEmptyStore(createProfilingBridgeStub(createSession()));

    await expect(store.getProfileTimeline(DEVICE_ID, { rootId: 9 })).rejects.toThrow(
      'No React profiling data available for root "9".',
    );
  });

  it('drops a root whose data came from more than one renderer', async () => {
    const dataForRoots = createSession();
    const store = createEmptyStore(
      createBridgeStub({
        getProfilingDataSnapshot: () =>
          createProfilingSnapshot({ dataForRoots, conflictingRootIds: new Set([2]) }),
      }),
    );

    const result = await store.getProfileTimeline(DEVICE_ID, {});

    expect(result.summary.roots).toEqual([1]);
    expect(result.summary.skippedRootIds).toEqual([2]);
    expect(result.items.every((item) => item.rootId === 1)).toBe(true);
  });

  it('rounds a derived average instead of emitting float noise', async () => {
    const store = createEmptyStore(createProfilingBridgeStub(createSession()));

    const result = await store.getComponentRenders(DEVICE_ID, { rootId: 1 });

    // Row rendered 4ms, 2ms and 1ms.
    expect(result.items.find((item) => item.fiberId === 3)?.avgDurationMs).toBe(2.333);
  });
});
