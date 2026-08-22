import { describe, expect, it } from 'vitest';
import { summarizeCoverage } from '../coverage';
import { APPLICATION_PACKAGE } from '../packages';
import type { BundleModuleInfo } from '../../../shared';

const mod = (id: number | string, name: string, evaluated: boolean): BundleModuleInfo => ({
  id,
  name,
  evaluated,
});

describe('summarizeCoverage', () => {
  it('returns zeroed totals and no packages for empty input', () => {
    expect(summarizeCoverage([])).toEqual({ evaluated: 0, total: 0, packages: [] });
  });

  it('groups modules by package and counts evaluated/total per package', () => {
    const modules = [
      mod(1, 'node_modules/lodash/a.js', true),
      mod(2, 'node_modules/lodash/b.js', false),
      mod(3, 'node_modules/react/index.js', true),
    ];

    const summary = summarizeCoverage(modules);

    expect(summary.evaluated).toBe(2);
    expect(summary.total).toBe(3);

    const lodash = summary.packages.find((pkg) => pkg.name === 'lodash');
    const react = summary.packages.find((pkg) => pkg.name === 'react');

    expect(lodash).toEqual({ name: 'lodash', evaluated: 1, total: 2 });
    expect(react).toEqual({ name: 'react', evaluated: 1, total: 1 });
  });

  it('groups application code (no node_modules segment) under APPLICATION_PACKAGE', () => {
    const modules = [mod(1, 'src/App.tsx', true), mod(2, 'src/screens/Home.tsx', false)];

    const summary = summarizeCoverage(modules);

    expect(summary.packages).toEqual([{ name: APPLICATION_PACKAGE, evaluated: 1, total: 2 }]);
  });

  it('reports a fully-evaluated package with zero unevaluated', () => {
    const modules = [
      mod(1, 'node_modules/react/index.js', true),
      mod(2, 'node_modules/react/jsx-runtime.js', true),
    ];

    const summary = summarizeCoverage(modules);

    expect(summary.packages).toEqual([{ name: 'react', evaluated: 2, total: 2 }]);
  });

  it('reports a fully-unevaluated package', () => {
    const modules = [
      mod(1, 'node_modules/lazy-lib/a.js', false),
      mod(2, 'node_modules/lazy-lib/b.js', false),
    ];

    const summary = summarizeCoverage(modules);

    expect(summary.packages).toEqual([{ name: 'lazy-lib', evaluated: 0, total: 2 }]);
  });

  it('sorts by unevaluated count descending, tie-broken by total descending then name ascending', () => {
    const modules = [
      // "alpha": 3 total, 1 evaluated -> 2 unevaluated
      mod(1, 'node_modules/alpha/a.js', true),
      mod(2, 'node_modules/alpha/b.js', false),
      mod(3, 'node_modules/alpha/c.js', false),
      // "beta": 2 total, 0 evaluated -> 2 unevaluated (tie with alpha on
      // unevaluated count; alpha wins the tie because it has more total
      // modules)
      mod(4, 'node_modules/beta/a.js', false),
      mod(5, 'node_modules/beta/b.js', false),
      // "gamma": 2 total, 0 evaluated -> 2 unevaluated, same total as
      // "delta" below -> tie broken by name ascending
      mod(6, 'node_modules/gamma/a.js', false),
      mod(7, 'node_modules/gamma/b.js', false),
      mod(8, 'node_modules/delta/a.js', false),
      mod(9, 'node_modules/delta/b.js', false),
      // "epsilon": fully evaluated -> 0 unevaluated, sorts last
      mod(10, 'node_modules/epsilon/a.js', true),
    ];

    const summary = summarizeCoverage(modules);

    expect(summary.packages.map((pkg) => pkg.name)).toEqual([
      'alpha',
      'beta',
      'delta',
      'gamma',
      'epsilon',
    ]);
  });
});
