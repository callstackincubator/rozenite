import { describe, expect, it } from 'vitest';
import {
  aggregateModules,
  countModules,
  filterChains,
  matchesQuery,
  toFlameGraphNode,
} from '../aggregations';
import { formatDuration, formatOffset } from '../format';
import type { RequireChainMeta, RequireTimingNode } from '../../shared';

const node = (
  name: string,
  value: number,
  selfTime: number,
  children: RequireTimingNode[] = [],
): RequireTimingNode => ({
  name,
  value,
  selfTime,
  tooltip: `src/${name}`,
  children,
});

const chain = (index: number, duration: number): RequireChainMeta => ({
  index,
  rootModuleId: index,
  rootModuleName: `root-${index}`,
  duration,
  moduleCount: 1,
  startedAt: 1000 + index,
});

describe('toFlameGraphNode', () => {
  it('returns null for a missing tree', () => {
    expect(toFlameGraphNode(null)).toBeNull();
  });

  it('maps self time onto the flame graph self value', () => {
    const tree = node('app.ts', 30, 10, [node('a.ts', 20, 20)]);

    expect(toFlameGraphNode(tree)).toEqual({
      name: 'app.ts',
      value: 30,
      selfValue: 10,
      tooltip: 'src/app.ts',
      children: [
        {
          name: 'a.ts',
          value: 20,
          selfValue: 20,
          tooltip: 'src/a.ts',
          children: [],
        },
      ],
    });
  });
});

describe('aggregateModules', () => {
  it('returns an empty list for a missing tree', () => {
    expect(aggregateModules(null)).toEqual([]);
  });

  it('orders modules by self time, heaviest first', () => {
    const tree = node('app.ts', 100, 5, [node('slow.ts', 80, 80), node('fast.ts', 15, 15)]);

    expect(aggregateModules(tree).map((stat) => stat.name)).toEqual([
      'slow.ts',
      'fast.ts',
      'app.ts',
    ]);
  });

  it('folds repeated evaluations of one module into a single row', () => {
    const tree = node('app.ts', 100, 10, [
      node('shared.ts', 40, 40),
      node('feature.ts', 50, 10, [node('shared.ts', 40, 40)]),
    ]);

    const shared = aggregateModules(tree).find((stat) => stat.name === 'shared.ts');

    expect(shared).toMatchObject({
      occurrences: 2,
      selfTime: 80,
      totalTime: 80,
      depth: 1,
    });
  });
});

describe('countModules', () => {
  it('counts every node in the tree', () => {
    expect(
      countModules(node('a', 1, 1, [node('b', 1, 1), node('c', 1, 1, [node('d', 1, 1)])])),
    ).toBe(4);
    expect(countModules(null)).toBe(0);
  });
});

describe('filterChains', () => {
  it('keeps every chain when the threshold is not positive', () => {
    const chains = [chain(0, 1), chain(1, 500)];

    expect(filterChains(chains, 0)).toBe(chains);
  });

  it('filters on the duration carried by the chain list, without loading trees', () => {
    expect(filterChains([chain(0, 1), chain(1, 500)], 100)).toEqual([chain(1, 500)]);
  });
});

describe('matchesQuery', () => {
  it('matches case-insensitively', () => {
    expect(matchesQuery('src/Screens/Home.tsx', 'home')).toBe(true);
    expect(matchesQuery('src/Screens/Home.tsx', 'settings')).toBe(false);
  });
});

describe('formatDuration', () => {
  it('scales the unit and precision to the magnitude', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(0.25)).toBe('0.25ms');
    expect(formatDuration(4.56)).toBe('4.6ms');
    expect(formatDuration(123.4)).toBe('123ms');
    expect(formatDuration(2500)).toBe('2.50s');
  });

  it('falls back to zero for missing values', () => {
    expect(formatDuration(undefined)).toBe('0ms');
    expect(formatDuration(Number.NaN)).toBe('0ms');
  });
});

describe('formatOffset', () => {
  it('reports the delay since the first chain', () => {
    expect(formatOffset(1500, 1000)).toBe('+500ms');
    expect(formatOffset(900, 1000)).toBe('+0ms');
  });
});
