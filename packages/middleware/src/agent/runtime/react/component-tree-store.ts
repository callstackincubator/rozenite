import type { ReactTreeNodeInput, ReactTreeSyncPayload } from './types.js';
import { parseTreeOperations, toReactElementTypeLabel } from './operations-parser.js';

type TreeNodeRecord = {
  nodeId: number;
  displayName: string;
  elementType: string;
  key?: string;
  parentId?: number;
  rendererId?: number;
  childIds: number[];
  errorCount: number;
  warningCount: number;
};

const isInteger = (value: unknown): value is number => {
  return Number.isInteger(value);
};

export const createComponentTreeStore = () => {
  const nodesById = new Map<number, TreeNodeRecord>();
  const rootIds = new Set<number>();
  let usesExtendedAddFormat = false;

  const removeNode = (nodeId: number): void => {
    const node = nodesById.get(nodeId);
    if (!node) {
      return;
    }

    for (const childId of [...node.childIds]) {
      removeNode(childId);
    }

    if (node.parentId !== undefined) {
      const parent = nodesById.get(node.parentId);
      if (parent) {
        parent.childIds = parent.childIds.filter((id) => id !== nodeId);
      }
    }

    rootIds.delete(nodeId);
    nodesById.delete(nodeId);
  };

  const addNode = (node: {
    nodeId: number;
    parentId?: number;
    rendererId: number;
    elementType: number;
    displayName: string;
    key?: string;
    isRoot: boolean;
  }): void => {
    removeNode(node.nodeId);

    const record: TreeNodeRecord = {
      nodeId: node.nodeId,
      displayName: node.displayName,
      elementType: toReactElementTypeLabel(node.elementType),
      ...(node.key !== undefined ? { key: node.key } : {}),
      ...(node.parentId !== undefined ? { parentId: node.parentId } : {}),
      ...(isInteger(node.rendererId) ? { rendererId: node.rendererId } : {}),
      childIds: [],
      // A remount is an add, and React re-reports counts against the new fiber,
      // so starting from zero is what keeps a fixed component from looking broken.
      errorCount: 0,
      warningCount: 0,
    };

    nodesById.set(record.nodeId, record);

    if (node.isRoot || node.parentId === undefined) {
      rootIds.add(record.nodeId);
      return;
    }

    const parent = nodesById.get(node.parentId);
    if (parent) {
      if (!parent.childIds.includes(record.nodeId)) {
        parent.childIds.push(record.nodeId);
      }
      parent.childIds = parent.childIds.filter((id, index, ids) => ids.indexOf(id) === index);
    }
  };

  const reorderChildren = (nodeId: number, childIds: number[]): void => {
    const node = nodesById.get(nodeId);
    if (!node) {
      return;
    }

    node.childIds = childIds
      .filter((id, index, ids) => ids.indexOf(id) === index)
      .filter((id) => nodesById.has(id));

    for (const childId of node.childIds) {
      const child = nodesById.get(childId);
      if (child) {
        child.parentId = nodeId;
        rootIds.delete(childId);
      }
    }
  };

  const updateErrorsOrWarnings = (
    nodeId: number,
    errorCount: number,
    warningCount: number,
  ): void => {
    const node = nodesById.get(nodeId);
    if (!node) {
      return;
    }

    node.errorCount = errorCount;
    node.warningCount = warningCount;
  };

  const toSnapshot = (): ReactTreeSyncPayload => {
    const sortedRoots = [...rootIds]
      .filter((rootId) => nodesById.has(rootId))
      .sort((a, b) => a - b);

    const visited = new Set<number>();
    const queue = [...sortedRoots];
    const nodes: ReactTreeNodeInput[] = [];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) {
        continue;
      }
      visited.add(nodeId);

      const node = nodesById.get(nodeId);
      if (!node) {
        continue;
      }

      const childIds = node.childIds.filter((childId) => nodesById.has(childId));
      nodes.push({
        nodeId: node.nodeId,
        displayName: node.displayName,
        elementType: node.elementType,
        ...(node.key !== undefined ? { key: node.key } : {}),
        ...(node.parentId !== undefined ? { parentId: node.parentId } : {}),
        ...(node.rendererId !== undefined ? { rendererId: node.rendererId } : {}),
        ...(node.errorCount > 0 ? { errorCount: node.errorCount } : {}),
        ...(node.warningCount > 0 ? { warningCount: node.warningCount } : {}),
        childIds,
      });

      for (const childId of childIds) {
        queue.push(childId);
      }
    }

    return {
      roots: sortedRoots,
      nodes,
    };
  };

  const ingestOperations = (operations: unknown): ReactTreeSyncPayload | null => {
    const parsed = parseTreeOperations(operations, {
      extendedAddFormat: usesExtendedAddFormat,
    });
    if (!parsed) {
      return null;
    }

    usesExtendedAddFormat = parsed.usesExtendedAddFormat;

    for (const nodeId of parsed.removedNodeIds) {
      removeNode(nodeId);
    }

    for (const rootId of parsed.removedRootIds) {
      removeNode(rootId);
    }

    for (const node of parsed.added) {
      addNode(node);
    }

    for (const reorder of parsed.reorderedChildren) {
      reorderChildren(reorder.nodeId, reorder.childIds);
    }

    for (const update of parsed.errorsOrWarnings) {
      updateErrorsOrWarnings(update.nodeId, update.errorCount, update.warningCount);
    }

    return toSnapshot();
  };

  return {
    ingestOperations,
    getRootsCount: (): number => {
      return [...rootIds].filter((rootId) => nodesById.has(rootId)).length;
    },
  };
};
