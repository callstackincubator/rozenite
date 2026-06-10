import { describe, expect, it } from 'vitest';
import { createReactTreeStore } from '../store.js';

const DEVICE_ID = 'device-1';

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

