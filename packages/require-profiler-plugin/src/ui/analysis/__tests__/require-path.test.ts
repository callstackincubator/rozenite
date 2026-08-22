import { describe, expect, it } from 'vitest';
import { findRequirePath } from '../require-path';
import type { RequireTimingNode } from '../../../shared';

const node = (
  tooltip: string,
  value: number,
  selfTime: number,
  children: RequireTimingNode[] = [],
): RequireTimingNode => ({
  name: tooltip.split('/').pop() ?? tooltip,
  value,
  selfTime,
  tooltip,
  children,
});

describe('findRequirePath', () => {
  it('returns the full root-first chain for a nested module', () => {
    const tree = node('src/app.ts', 100, 10, [
      node('src/feature.ts', 60, 10, [node('node_modules/lodash/a.js', 40, 40)]),
    ]);

    const result = findRequirePath(tree, 'node_modules/lodash/a.js');

    expect(result.entries).toEqual([
      { name: 'app.ts', path: 'src/app.ts', depth: 0 },
      { name: 'feature.ts', path: 'src/feature.ts', depth: 1 },
      { name: 'a.js', path: 'node_modules/lodash/a.js', depth: 2 },
    ]);
    expect(result.occurrences).toBe(1);
  });

  it('returns a single entry when the target is the root itself', () => {
    const tree = node('src/app.ts', 100, 100, []);

    const result = findRequirePath(tree, 'src/app.ts');

    expect(result.entries).toEqual([{ name: 'app.ts', path: 'src/app.ts', depth: 0 }]);
    expect(result.occurrences).toBe(1);
  });

  it('returns empty entries and zero occurrences for a module absent from the tree', () => {
    const tree = node('src/app.ts', 100, 100, []);

    const result = findRequirePath(tree, 'src/missing.ts');

    expect(result.entries).toEqual([]);
    expect(result.occurrences).toBe(0);
  });

  it('returns empty entries and zero occurrences for a null root', () => {
    const result = findRequirePath(null, 'src/app.ts');

    expect(result.entries).toEqual([]);
    expect(result.occurrences).toBe(0);
  });

  it('picks the shallowest occurrence when the module appears at several depths', () => {
    // shared.js sits at depth 1 via `src/early.ts` and at depth 3 via a
    // deeper branch; the depth-1 chain must win.
    const tree = node('src/app.ts', 100, 10, [
      node('src/early.ts', 20, 10, [node('node_modules/shared/shared.js', 10, 10)]),
      node('src/deep-a.ts', 60, 10, [
        node('src/deep-b.ts', 50, 10, [node('node_modules/shared/shared.js', 40, 40)]),
      ]),
    ]);

    const result = findRequirePath(tree, 'node_modules/shared/shared.js');

    expect(result.entries).toEqual([
      { name: 'app.ts', path: 'src/app.ts', depth: 0 },
      { name: 'early.ts', path: 'src/early.ts', depth: 1 },
      { name: 'shared.js', path: 'node_modules/shared/shared.js', depth: 2 },
    ]);
    expect(result.occurrences).toBe(2);
  });

  it('counts every occurrence in the tree, including ones off the returned path', () => {
    const tree = node('src/app.ts', 100, 10, [
      node('node_modules/lodash/a.js', 30, 30),
      node('src/feature.ts', 60, 10, [node('node_modules/lodash/a.js', 40, 40)]),
    ]);

    const result = findRequirePath(tree, 'node_modules/lodash/a.js');

    expect(result.occurrences).toBe(2);
    // The shallowest (depth-1, direct child of the root) chain is returned.
    expect(result.entries.map((entry) => entry.path)).toEqual([
      'src/app.ts',
      'node_modules/lodash/a.js',
    ]);
  });

  it('breaks a tie at the same depth deterministically, by traversal order', () => {
    // Both `a.js` occurrences sit at depth 1, under different siblings of the
    // root. The one under the first (left-most) child wins.
    const tree = node('src/app.ts', 100, 10, [
      node('src/branch-a.ts', 30, 30, [node('node_modules/pkg/a.js', 10, 10)]),
      node('src/branch-b.ts', 30, 30, [node('node_modules/pkg/a.js', 10, 10)]),
    ]);

    const result = findRequirePath(tree, 'node_modules/pkg/a.js');

    expect(result.entries.map((entry) => entry.path)).toEqual([
      'src/app.ts',
      'src/branch-a.ts',
      'node_modules/pkg/a.js',
    ]);
    expect(result.occurrences).toBe(2);
  });
});
