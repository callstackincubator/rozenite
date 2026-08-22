import type { BundleModuleInfo } from '../../shared';
import { getPackageName } from './packages';

export type PackageCoverage = {
  name: string;
  evaluated: number;
  total: number;
};

export type CoverageSummary = {
  evaluated: number;
  total: number;
  packages: PackageCoverage[];
};

/**
 * Groups the bundle's module registry by package and counts how many
 * modules in each have been evaluated. Packages are sorted so the biggest
 * code-splitting candidates - the packages with the most modules that have
 * not yet run - surface first: unevaluated count descending, ties broken by
 * total module count descending, then package name ascending for a stable
 * order.
 */
export const summarizeCoverage = (modules: BundleModuleInfo[]): CoverageSummary => {
  const byPackage = new Map<string, PackageCoverage>();

  let evaluated = 0;

  for (const module of modules) {
    if (module.evaluated) {
      evaluated += 1;
    }

    const name = getPackageName(module.name);
    let stat = byPackage.get(name);
    if (!stat) {
      stat = { name, evaluated: 0, total: 0 };
      byPackage.set(name, stat);
    }

    stat.total += 1;
    if (module.evaluated) {
      stat.evaluated += 1;
    }
  }

  const packages = [...byPackage.values()].sort((a, b) => {
    const unevaluatedA = a.total - a.evaluated;
    const unevaluatedB = b.total - b.evaluated;

    if (unevaluatedA !== unevaluatedB) {
      return unevaluatedB - unevaluatedA;
    }

    if (a.total !== b.total) {
      return b.total - a.total;
    }

    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });

  return {
    evaluated,
    total: modules.length,
    packages,
  };
};
