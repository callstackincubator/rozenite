import { describe, expect, it } from 'vitest';
import {
  APPLICATION_PACKAGE,
  aggregatePackages,
  getPackageName,
  getPackageRoot,
} from '../packages';
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

describe('getPackageName / getPackageRoot', () => {
  it('resolves a plain package', () => {
    const path = 'node_modules/lodash/lodash.js';

    expect(getPackageName(path)).toBe('lodash');
    expect(getPackageRoot(path)).toBe('node_modules/lodash');
  });

  it('resolves a scoped package, taking two segments for the name', () => {
    const path = 'node_modules/@react-navigation/native/lib/index.js';

    expect(getPackageName(path)).toBe('@react-navigation/native');
    expect(getPackageRoot(path)).toBe('node_modules/@react-navigation/native');
  });

  it('resolves the inner package for a nested copy, using the LAST node_modules segment', () => {
    const path = 'node_modules/a/node_modules/lodash/x.js';

    expect(getPackageName(path)).toBe('lodash');
    expect(getPackageRoot(path)).toBe('node_modules/a/node_modules/lodash');
  });

  it('treats application code (no node_modules segment) as APPLICATION_PACKAGE', () => {
    const path = 'src/screens/Home.tsx';

    expect(getPackageName(path)).toBe(APPLICATION_PACKAGE);
    expect(getPackageRoot(path)).toBeNull();
  });

  it('does not match a directory whose name merely contains "node_modules"', () => {
    const path = 'src/my_node_modules_helper/x.ts';

    expect(getPackageName(path)).toBe(APPLICATION_PACKAGE);
    expect(getPackageRoot(path)).toBeNull();
  });

  it('treats a path that ends at node_modules/ with nothing after it as application code', () => {
    expect(getPackageName('libs/node_modules/')).toBe(APPLICATION_PACKAGE);
    expect(getPackageRoot('libs/node_modules/')).toBeNull();
    expect(getPackageName('libs/node_modules')).toBe(APPLICATION_PACKAGE);
    expect(getPackageRoot('libs/node_modules')).toBeNull();
  });

  it('returns APPLICATION_PACKAGE / null for an empty string', () => {
    expect(getPackageName('')).toBe(APPLICATION_PACKAGE);
    expect(getPackageRoot('')).toBeNull();
  });

  it('strips a leading ./ before matching', () => {
    const path = './node_modules/lodash/lodash.js';

    expect(getPackageName(path)).toBe('lodash');
    expect(getPackageRoot(path)).toBe('node_modules/lodash');
  });
});

describe('aggregatePackages', () => {
  it('returns an empty list for a missing tree', () => {
    expect(aggregatePackages(null)).toEqual([]);
  });

  it('groups several modules of the same package together', () => {
    const tree = node('src/app.ts', 100, 10, [
      node('node_modules/lodash/a.js', 30, 20, [node('node_modules/lodash/b.js', 10, 10)]),
    ]);

    const stats = aggregatePackages(tree);
    const lodash = stats.find((stat) => stat.name === 'lodash');

    expect(lodash).toMatchObject({
      selfTime: 30,
      inclusiveTime: 30,
      moduleCount: 2,
      entryCount: 1,
    });
  });

  it('does not double-count inclusiveTime when a package is nested inside itself', () => {
    // lodash -> app-glue -> lodash: the inner lodash node's subtree must not
    // be counted again in the outer lodash entry's inclusiveTime.
    const tree = node('node_modules/lodash/outer.js', 100, 10, [
      node('src/glue.ts', 60, 5, [node('node_modules/lodash/inner.js', 40, 40)]),
    ]);

    const stats = aggregatePackages(tree);
    const lodash = stats.find((stat) => stat.name === 'lodash');
    const app = stats.find((stat) => stat.name === APPLICATION_PACKAGE);

    // Only the outer lodash node is an entry; its value (100) already
    // includes the inner lodash node's subtree, so it must count once.
    expect(lodash).toMatchObject({
      selfTime: 50,
      inclusiveTime: 100,
      moduleCount: 2,
      entryCount: 1,
    });
    expect(app).toMatchObject({
      selfTime: 5,
      inclusiveTime: 60,
      moduleCount: 1,
      entryCount: 1,
    });
  });

  it('counts a package entered at two separate points in the tree', () => {
    const tree = node('src/app.ts', 100, 20, [
      node('node_modules/lodash/a.js', 30, 30),
      node('node_modules/lodash/b.js', 50, 50),
    ]);

    const lodash = aggregatePackages(tree).find((stat) => stat.name === 'lodash');

    expect(lodash).toMatchObject({
      selfTime: 80,
      inclusiveTime: 80,
      moduleCount: 2,
      entryCount: 2,
    });
  });

  it('folds a module evaluated twice into a single moduleCount', () => {
    const tree = node('src/app.ts', 100, 10, [
      node('node_modules/lodash/shared.js', 40, 40),
      node('src/feature.ts', 50, 10, [node('node_modules/lodash/shared.js', 40, 40)]),
    ]);

    const lodash = aggregatePackages(tree).find((stat) => stat.name === 'lodash');

    expect(lodash?.moduleCount).toBe(1);
    expect(lodash?.entryCount).toBe(2);
    expect(lodash?.selfTime).toBe(80);
  });

  it('orders packages by self time, heaviest first', () => {
    const tree = node('src/app.ts', 100, 5, [
      node('node_modules/slow-pkg/a.js', 80, 80),
      node('node_modules/fast-pkg/a.js', 15, 15),
    ]);

    expect(aggregatePackages(tree).map((stat) => stat.name)).toEqual([
      'slow-pkg',
      'fast-pkg',
      APPLICATION_PACKAGE,
    ]);
  });
});
