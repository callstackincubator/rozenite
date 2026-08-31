import { describe, expect, it } from 'vitest';
import { createReactTreeStore } from '../store.js';
import { createComponentTreeStore } from '../component-tree-store.js';
import { TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS } from '../operations-parser.js';

const DEVICE_ID = 'device-errors';

const createStore = () => {
  const store = createReactTreeStore();
  store.registerDevice(DEVICE_ID);
  store.syncTree(DEVICE_ID, {
    roots: [1],
    nodes: [
      { nodeId: 1, displayName: 'Root', elementType: 'root', childIds: [2, 3, 4] },
      { nodeId: 2, displayName: 'Clean', elementType: 'function', parentId: 1, childIds: [] },
      {
        nodeId: 3,
        displayName: 'Noisy',
        elementType: 'function',
        parentId: 1,
        errorCount: 2,
        warningCount: 1,
        childIds: [],
      },
      {
        nodeId: 4,
        displayName: 'Warned',
        elementType: 'function',
        parentId: 1,
        warningCount: 5,
        childIds: [],
      },
    ],
  });

  return store;
};

describe('React getErrors', () => {
  it('lists only affected components, most errors first', () => {
    const result = createStore().getErrors(DEVICE_ID, {});

    expect(result.items).toEqual([
      expect.objectContaining({ nodeId: 3, errorCount: 2, warningCount: 1 }),
      expect.objectContaining({ nodeId: 4, warningCount: 5 }),
    ]);
    expect(result.items[1]).not.toHaveProperty('errorCount');
    expect(result.summary).toEqual({ nodeCount: 2, totalErrors: 2, totalWarnings: 6 });
  });

  it('paginates with a cursor', () => {
    const store = createStore();
    const firstPage = store.getErrors(DEVICE_ID, { limit: 1 });

    expect(firstPage.items.map((item) => item.nodeId)).toEqual([3]);
    expect(firstPage.totalCount).toBe(2);
    expect(firstPage.page.hasMore).toBe(true);

    const secondPage = store.getErrors(DEVICE_ID, {
      limit: 1,
      cursor: firstPage.page.nextCursor,
    });

    expect(secondPage.items.map((item) => item.nodeId)).toEqual([4]);
    expect(secondPage.page.hasMore).toBe(false);
  });

  it('scopes to a subtree', () => {
    const store = createStore();

    expect(store.getErrors(DEVICE_ID, { root: 2 }).items).toEqual([]);
    expect(store.getErrors(DEVICE_ID, { root: 3 }).items.map((item) => item.nodeId)).toEqual([3]);
  });

  it('surfaces counts on the ordinary tree and node reads', () => {
    const store = createStore();

    expect(store.getNode(DEVICE_ID, { nodeId: 3 })).toMatchObject({
      errorCount: 2,
      warningCount: 1,
    });
    expect(store.getTree(DEVICE_ID, {}).items.find((item) => item.nodeId === 2)).not.toHaveProperty(
      'errorCount',
    );
  });
});

describe('component tree store errors and warnings', () => {
  const addRootAndChild = [
    1, // rendererId
    1, // rootId
    5, // string table size
    4, // "Node" length
    78,
    111,
    100,
    101,
    1, // TREE_OPERATION_ADD
    1,
    11, // ELEMENT_TYPE_ROOT
    0,
    0,
    0,
    0,
    1, // TREE_OPERATION_ADD
    2,
    5, // ELEMENT_TYPE_FUNCTION
    1, // parentId
    0, // ownerId
    1, // displayName string id
    0, // key string id
  ];

  it('applies counts to the node and clears them on a remount', () => {
    const store = createComponentTreeStore();
    store.ingestOperations(addRootAndChild);

    const withCounts = store.ingestOperations([
      1,
      1,
      0,
      TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS,
      2,
      1,
      4,
    ]);
    expect(withCounts?.nodes.find((node) => node.nodeId === 2)).toMatchObject({
      errorCount: 1,
      warningCount: 4,
    });

    const cleared = store.ingestOperations([
      1,
      1,
      0,
      TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS,
      2,
      0,
      0,
    ]);
    const node = cleared?.nodes.find((entry) => entry.nodeId === 2);
    expect(node).not.toHaveProperty('errorCount');
    expect(node).not.toHaveProperty('warningCount');
  });
});
