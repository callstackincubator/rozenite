import type { FlameGraphNode } from '@rozenite/ui';
import type { RequireChainMeta, RequireTimingNode } from '../shared';

export type ModuleStat = {
  /** Full module path, unique within a chain. */
  path: string;
  /** File name, used as the display label. */
  name: string;
  /** Time spent evaluating the module itself, excluding its dependencies. */
  selfTime: number;
  /** Time spent evaluating the module and everything it pulled in. */
  totalTime: number;
  /** How many times the module was evaluated within the chain. */
  occurrences: number;
  /** Depth of the shallowest occurrence in the require tree. */
  depth: number;
};

/**
 * Maps a recorded require tree onto the shape `@rozenite/ui`'s `FlameGraph`
 * consumes. The full module path doubles as the frame identity, so selection
 * survives re-renders and stays meaningful across chains.
 */
export const toFlameGraphNode = (node: RequireTimingNode | null): FlameGraphNode | null => {
  if (!node) {
    return null;
  }

  return {
    name: node.name,
    value: node.value,
    selfValue: node.selfTime,
    tooltip: node.tooltip,
    children: node.children.map(toFlameGraphNode).filter((child): child is FlameGraphNode => {
      return child !== null;
    }),
  };
};

/**
 * Flattens a require tree into per-module totals, so the slowest modules can be
 * read off a table instead of hunted for in the graph. A module evaluated more
 * than once in a chain is folded into a single row with summed times.
 */
export const aggregateModules = (node: RequireTimingNode | null): ModuleStat[] => {
  if (!node) {
    return [];
  }

  const stats = new Map<string, ModuleStat>();

  const visit = (current: RequireTimingNode, depth: number): void => {
    const existing = stats.get(current.tooltip);

    if (existing) {
      existing.selfTime += current.selfTime;
      existing.totalTime += current.value;
      existing.occurrences += 1;
      existing.depth = Math.min(existing.depth, depth);
    } else {
      stats.set(current.tooltip, {
        path: current.tooltip,
        name: current.name,
        selfTime: current.selfTime,
        totalTime: current.value,
        occurrences: 1,
        depth,
      });
    }

    for (const child of current.children) {
      visit(child, depth + 1);
    }
  };

  visit(node, 0);

  return [...stats.values()].sort((a, b) => b.selfTime - a.selfTime);
};

export const countModules = (node: RequireTimingNode | null): number => {
  if (!node) {
    return 0;
  }

  return node.children.reduce((total, child) => total + countModules(child), 1);
};

export const matchesQuery = (value: string, query: string): boolean => {
  return value.toLowerCase().includes(query.toLowerCase());
};

/**
 * Chains that clear the duration threshold. Durations now travel with the chain
 * list, so a chain no longer has to be loaded before it can be filtered out.
 */
export const filterChains = (
  chains: RequireChainMeta[],
  minDurationMs: number,
): RequireChainMeta[] => {
  if (minDurationMs <= 0) {
    return chains;
  }

  return chains.filter((chain) => chain.duration >= minDurationMs);
};
