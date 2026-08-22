import type { RequireTimingNode } from '../../shared';

export type RequirePathEntry = {
  /** Basename, for display. */
  name: string;
  /** Full module path — the module's identity. */
  path: string;
  /** Depth from the chain root, 0-based. */
  depth: number;
};

export type RequirePathResult = {
  /** Root-first chain of requires ending at the target module. Empty when
   *  the module is not present in the tree. */
  entries: RequirePathEntry[];
  /** How many distinct places in the tree evaluate this module. */
  occurrences: number;
};

type QueueEntry = {
  node: RequireTimingNode;
  /** Index of this entry's parent within the same queue, or -1 for the root. */
  parentIndex: number;
};

/**
 * Finds the chain of requires from the tree root down to `modulePath`, and
 * counts every place in the tree that evaluates it.
 *
 * When the module is evaluated more than once, the chain to the SHALLOWEST
 * occurrence is returned. Ties at the same depth are broken deterministically
 * by traversal order: the tree is walked breadth-first, visiting each node's
 * children in array order, so the first match encountered at the winning
 * depth is always the same one for a given tree.
 *
 * `occurrences` counts every matching node anywhere in the tree, not just
 * along the returned chain.
 */
export const findRequirePath = (
  root: RequireTimingNode | null,
  modulePath: string,
): RequirePathResult => {
  if (!root) {
    return { entries: [], occurrences: 0 };
  }

  // Breadth-first over an array used as a growing queue (no `.shift()`, so
  // this stays O(n) rather than O(n^2)). Each entry keeps its parent's index
  // in the same array, so the path back to the root can be reconstructed
  // without copying an ancestors array at every node.
  const queue: QueueEntry[] = [{ node: root, parentIndex: -1 }];

  let occurrences = 0;
  let matchIndex = -1;

  for (let i = 0; i < queue.length; i++) {
    const { node } = queue[i];

    if (node.tooltip === modulePath) {
      occurrences += 1;
      if (matchIndex === -1) {
        matchIndex = i;
      }
    }

    for (const child of node.children) {
      queue.push({ node: child, parentIndex: i });
    }
  }

  if (matchIndex === -1) {
    return { entries: [], occurrences: 0 };
  }

  // Walk parent pointers back to the root, then reverse to root-first order.
  const chain: RequireTimingNode[] = [];
  for (let index = matchIndex; index !== -1; index = queue[index].parentIndex) {
    chain.push(queue[index].node);
  }
  chain.reverse();

  const entries: RequirePathEntry[] = chain.map((node, depth) => ({
    name: node.name,
    path: node.tooltip,
    depth,
  }));

  return { entries, occurrences };
};
