import type { RequireTimingNode } from '../../shared';

/** Sentinel package name for modules that are not under node_modules. */
export const APPLICATION_PACKAGE = '(application)';

type PackageMatch = {
  /** Path segments up to and including the package-name segment(s). */
  root: string[];
  /** The package name, e.g. `lodash` or `@react-navigation/native`. */
  name: string;
};

/**
 * Splits a module path into segments, dropping a leading `./` and any empty
 * segments (double slashes, a trailing slash).
 */
const splitSegments = (path: string): string[] =>
  path
    .replace(/^\.\//, '')
    .split('/')
    .filter((segment) => segment.length > 0);

/**
 * Locates the package a module path belongs to by finding the LAST
 * `node_modules` segment in the path — a nested copy
 * (`node_modules/a/node_modules/lodash/x.js`) resolves to the inner package,
 * because that is the copy actually evaluated. Matches on full path segments
 * only, so a directory like `my_node_modules_helper` never matches.
 */
const matchPackage = (path: string): PackageMatch | null => {
  const segments = splitSegments(path);

  let lastNodeModulesIndex = -1;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i] === 'node_modules') {
      lastNodeModulesIndex = i;
    }
  }

  if (lastNodeModulesIndex === -1) {
    return null;
  }

  const after = segments.slice(lastNodeModulesIndex + 1);

  if (after.length === 0) {
    // A path that ends at `node_modules/` with nothing after it names no package.
    return null;
  }

  const nameSegments =
    after[0].startsWith('@') && after.length > 1 ? after.slice(0, 2) : after.slice(0, 1);

  return {
    root: [...segments.slice(0, lastNodeModulesIndex + 1), ...nameSegments],
    name: nameSegments.join('/'),
  };
};

/** The npm package a module path belongs to, or `APPLICATION_PACKAGE`. */
export const getPackageName = (path: string): string => {
  return matchPackage(path)?.name ?? APPLICATION_PACKAGE;
};

/**
 * The path up to and including the package's own directory, e.g.
 * `node_modules/a/node_modules/lodash`. `null` for application code.
 */
export const getPackageRoot = (path: string): string | null => {
  const match = matchPackage(path);
  return match ? match.root.join('/') : null;
};

export type PackageStat = {
  name: string;
  /** Sum of member modules' own evaluation time. Exactly additive. */
  selfTime: number;
  /** Sum of `value` over entry nodes only — the package's cost including
   *  everything it pulled in, with no double counting. */
  inclusiveTime: number;
  moduleCount: number;
  /** How many separate places in the tree enter this package. */
  entryCount: number;
};

/**
 * Rolls a require tree up to per-package totals. `selfTime` sums every
 * member node's own time, which is exact since self times partition the
 * total. `inclusiveTime` only sums `value` on entry nodes — a node whose
 * nearest ancestor is not in the same package — so a package nested inside
 * itself (or entered more than once) is never double-counted.
 */
export const aggregatePackages = (node: RequireTimingNode | null): PackageStat[] => {
  if (!node) {
    return [];
  }

  const stats = new Map<string, PackageStat>();
  const modulePaths = new Map<string, Set<string>>();
  // Count of currently-open ancestors (including the node itself, once
  // visited) per package, so nesting of the same package at any depth -- not
  // just via the immediate parent -- is detected.
  const openAncestors = new Map<string, number>();

  const ensureStat = (name: string): PackageStat => {
    let stat = stats.get(name);
    if (!stat) {
      stat = { name, selfTime: 0, inclusiveTime: 0, moduleCount: 0, entryCount: 0 };
      stats.set(name, stat);
      modulePaths.set(name, new Set());
    }
    return stat;
  };

  const visit = (current: RequireTimingNode): void => {
    const pkg = getPackageName(current.tooltip);
    const stat = ensureStat(pkg);

    stat.selfTime += current.selfTime;
    modulePaths.get(pkg)!.add(current.tooltip);

    const openCount = openAncestors.get(pkg) ?? 0;
    const isEntry = openCount === 0;

    if (isEntry) {
      stat.entryCount += 1;
      stat.inclusiveTime += current.value;
    }

    openAncestors.set(pkg, openCount + 1);
    for (const child of current.children) {
      visit(child);
    }
    openAncestors.set(pkg, openCount);
  };

  visit(node);

  for (const [pkg, stat] of stats) {
    stat.moduleCount = modulePaths.get(pkg)!.size;
  }

  return [...stats.values()].sort((a, b) => b.selfTime - a.selfTime);
};
