import { describe, expect, it } from 'vitest';
import { createReactTreeStore } from '../store.js';

const DEVICE_ID = 'device-host';

/**
 * Root
 * └─ App (function)
 *    ├─ View (plain host)     — hidden under noHost
 *    │  └─ Label (function)   — promoted onto App
 *    ├─ View key="row"        — kept: keyed
 *    ├─ my-widget (host)      — kept: custom element name
 *    └─ Text (plain host)     — hidden, no children to promote
 *
 * React DevTools' backend normally strips host fibers before they reach the
 * store, so `noHost` is opt-in; this fixture supplies them directly.
 */
const createStore = () => {
  const store = createReactTreeStore();
  store.registerDevice(DEVICE_ID);
  store.syncTree(DEVICE_ID, {
    roots: [1],
    nodes: [
      { nodeId: 1, displayName: 'Root', elementType: 'root', childIds: [2] },
      {
        nodeId: 2,
        displayName: 'App',
        elementType: 'function',
        parentId: 1,
        childIds: [3, 5, 6, 7],
      },
      { nodeId: 3, displayName: 'View', elementType: 'host', parentId: 2, childIds: [4] },
      { nodeId: 4, displayName: 'Label', elementType: 'function', parentId: 3, childIds: [] },
      {
        nodeId: 5,
        displayName: 'View',
        elementType: 'host',
        key: 'row',
        parentId: 2,
        childIds: [],
      },
      { nodeId: 6, displayName: 'my-widget', elementType: 'host', parentId: 2, childIds: [] },
      { nodeId: 7, displayName: 'Text', elementType: 'host', parentId: 2, childIds: [] },
    ],
  });

  return store;
};

describe('React tree host filtering', () => {
  it('hides plain hosts and promotes their children onto the nearest visible ancestor', () => {
    const result = createStore().getTree(DEVICE_ID, { noHost: true });

    expect(result.items.map((item) => item.nodeId)).toEqual([1, 2, 4, 5, 6]);
    expect(result.totalCount).toBe(5);

    const app = result.items.find((item) => item.nodeId === 2)!;
    expect(app.childIds).toEqual([4, 5, 6]);
    expect(app.childCount).toBe(3);

    // Label was a grandchild through the hidden View; it now reads as App's child.
    const label = result.items.find((item) => item.nodeId === 4)!;
    expect(label).toMatchObject({ parentId: 2, parentLabel: '@c2', depth: 2 });
  });

  it('returns the raw React tree by default', () => {
    const result = createStore().getTree(DEVICE_ID, {});

    expect(result.items.map((item) => item.nodeId)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(result.items.find((item) => item.nodeId === 4)).toMatchObject({
      parentId: 3,
      depth: 3,
    });
  });

  it('keeps an explicitly requested host root visible', () => {
    const result = createStore().getTree(DEVICE_ID, { root: 3, noHost: true });

    expect(result.items.map((item) => item.nodeId)).toEqual([3, 4]);
    // The scoped root reports no parent: node 2 is outside what was asked for.
    expect(result.items[0]).not.toHaveProperty('parentId');
    expect(result.items[1]).toMatchObject({ parentId: 3 });
  });

  it('keeps a host that has logged errors or warnings', () => {
    const store = createReactTreeStore();
    store.registerDevice(DEVICE_ID);
    store.syncTree(DEVICE_ID, {
      roots: [1],
      nodes: [
        { nodeId: 1, displayName: 'Root', elementType: 'root', childIds: [2] },
        {
          nodeId: 2,
          displayName: 'View',
          elementType: 'host',
          parentId: 1,
          warningCount: 1,
          childIds: [],
        },
      ],
    });

    expect(store.getTree(DEVICE_ID, { noHost: true }).items.map((item) => item.nodeId)).toEqual([
      1, 2,
    ]);
  });

  it('serves getChildren through the same filter as getTree', () => {
    const store = createStore();

    expect(
      store.getChildren(DEVICE_ID, { nodeId: 2, noHost: true }).items.map((item) => item.nodeId),
    ).toEqual([4, 5, 6]);
    expect(store.getChildren(DEVICE_ID, { nodeId: 2 }).items.map((item) => item.nodeId)).toEqual([
      3, 5, 6, 7,
    ]);
  });

  it('excludes plain hosts from searchNodes only when asked', () => {
    const store = createStore();

    expect(
      store
        .searchNodes(DEVICE_ID, { query: 'View', noHost: true })
        .items.map((item) => item.nodeId),
    ).toEqual([5]);
    expect(store.searchNodes(DEVICE_ID, { query: 'View' }).items.map((i) => i.nodeId)).toEqual([
      3, 5,
    ]);
  });

  it('scopes a filtered tree cursor to the filter it was issued under', () => {
    const store = createStore();
    const firstPage = store.getTree(DEVICE_ID, { limit: 2, noHost: true });

    expect(() => store.getTree(DEVICE_ID, { limit: 2, cursor: firstPage.page.nextCursor })).toThrow(
      'Cursor does not match this request context',
    );
  });
});
