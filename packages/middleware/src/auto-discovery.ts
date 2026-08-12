import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { logger } from './logger.js';
import { ROZENITE_MANIFEST } from './constants.js';
import { RozeniteConfig } from './config.js';

const require = createRequire(import.meta.url);

// Discovery walks every direct dependency; a large monorepo app can list
// hundreds. Each one costs at least one fs op, so unbounded parallelism
// would just trade a slow sequential scan for a syscall storm. This is an
// I/O-latency-bound workload, not a CPU-bound one, so the cap is based on
// the core count but with a floor well above it — containers commonly
// report 2-4 cores, which would otherwise throttle exactly the
// slow/network-filesystem case this is meant to help.
const DISCOVERY_CONCURRENCY = Math.max(8, os.cpus().length);

// Metro loads this package as CJS, so this can't depend on p-limit (ESM-only
// since v3) without risking `ERR_REQUIRE_ESM` on Node versions that don't
// support requiring ESM. A bounded-concurrency queue is small enough to own.
const createLimiter = (concurrency: number) => {
  let active = 0;
  const queue: (() => void)[] = [];

  const next = () => {
    if (active >= concurrency || queue.length === 0) {
      return;
    }
    active++;
    queue.shift()?.();
  };

  return <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
};

export type InstalledPlugin = {
  name: string;
  path: string;
};

const readPackageJsonName = async (packagePath: string): Promise<string | null> => {
  try {
    const packageJsonPath = path.join(packagePath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    return typeof packageJson.name === 'string' ? packageJson.name : null;
  } catch {
    return null;
  }
};

// In a standard (hoisted) node_modules layout, a resolved file's path
// contains a `node_modules/<packageName>` segment that already *is* the
// package root, so it can be read directly instead of walking up the tree
// directory-by-directory. Falls back to null when no such segment exists
// (e.g. Yarn PnP or workspace symlinks with unconventional layouts).
const getHoistedRootCandidate = (packageName: string, resolvedPath: string): string | null => {
  const segments = resolvedPath.split(path.sep);
  const nodeModulesIndex = segments.lastIndexOf('node_modules');

  if (nodeModulesIndex === -1) {
    return null;
  }

  const nameSegments = packageName.split('/');
  const rootIndex = nodeModulesIndex + nameSegments.length;

  if (rootIndex >= segments.length) {
    return null;
  }

  const candidateName = segments.slice(nodeModulesIndex + 1, rootIndex + 1).join('/');

  if (candidateName !== packageName) {
    return null;
  }

  return segments.slice(0, rootIndex + 1).join(path.sep);
};

const walkUpToPackageRoot = async (
  packageName: string,
  resolvedPath: string,
): Promise<string | null> => {
  let currentPath = path.dirname(resolvedPath);

  while (true) {
    if ((await readPackageJsonName(currentPath)) === packageName) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);

    if (parentPath === currentPath) {
      return null;
    }

    currentPath = parentPath;
  }
};

export const findPackageRoot = async (
  packageName: string,
  resolvedPath: string,
): Promise<string | null> => {
  const hoistedRoot = getHoistedRootCandidate(packageName, resolvedPath);

  if (hoistedRoot && (await readPackageJsonName(hoistedRoot)) === packageName) {
    return hoistedRoot;
  }

  return walkUpToPackageRoot(packageName, resolvedPath);
};

// Mirrors Node's own node_modules lookup order: projectRoot/node_modules,
// then its parent's, and so on up to the filesystem root. In a workspace
// monorepo, most dependencies are hoisted a few levels up from the app's
// own directory, not directly inside it.
const getNodeModulesSearchDirs = (startDir: string): string[] => {
  const dirs: string[] = [];
  let currentDir = path.resolve(startDir);

  while (true) {
    dirs.push(path.join(currentDir, 'node_modules'));
    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      return dirs;
    }

    currentDir = parentDir;
  }
};

// Fast path for the common case: the dependency is hoisted under a
// node_modules directory Node would find by walking up from the project
// root, so its root can be read directly without paying for Node's full
// module resolution algorithm (which also resolves the package's main
// entry file, not just its root).
const resolveDirectNodeModulesRoot = async (
  projectRoot: string,
  packageName: string,
): Promise<string | null> => {
  for (const nodeModulesDir of getNodeModulesSearchDirs(projectRoot)) {
    const candidatePath = path.join(nodeModulesDir, ...packageName.split('/'));

    if ((await readPackageJsonName(candidatePath)) !== packageName) {
      continue;
    }

    try {
      // Package managers (e.g. pnpm) hoist via symlinks into a content
      // store. Resolve them to match require.resolve's behavior, which
      // returns real paths.
      return await fs.realpath(candidatePath);
    } catch {
      return null;
    }
  }

  return null;
};

const resolveViaModuleResolution = async (
  projectRoot: string,
  packageName: string,
): Promise<string | null> => {
  try {
    const resolvedPath = require.resolve(packageName, { paths: [projectRoot] });
    return await findPackageRoot(packageName, resolvedPath);
  } catch {
    return null;
  }
};

const resolvePackageRoot = async (
  projectRoot: string,
  packageName: string,
): Promise<string | null> => {
  const directRoot = await resolveDirectNodeModulesRoot(projectRoot, packageName);
  return directRoot ?? resolveViaModuleResolution(projectRoot, packageName);
};

const tryExtractPlugin = async (
  packagePath: string,
  packageName: string,
): Promise<InstalledPlugin | null> => {
  const rozeniteConfigPath = path.join(packagePath, 'dist', ROZENITE_MANIFEST);

  try {
    await fs.access(rozeniteConfigPath);
  } catch {
    return null;
  }

  return {
    name: packageName,
    path: packagePath,
  };
};

const getIncludedPlugins = async (options: RozeniteConfig): Promise<InstalledPlugin[]> => {
  assert(options.include, 'include is required');

  const plugins: InstalledPlugin[] = [];
  const normalizedInclude = options.exclude
    ? options.include.filter((plugin) => !options.exclude?.includes(plugin))
    : options.include;

  for (const maybePlugin of normalizedInclude) {
    const pluginPath = await resolvePackageRoot(options.projectRoot, maybePlugin);

    if (!pluginPath) {
      throw new Error(`Could not resolve plugin ${maybePlugin}.`);
    }

    const plugin = await tryExtractPlugin(pluginPath, maybePlugin);

    if (!plugin) {
      throw new Error(`Plugin ${maybePlugin} is not a valid Rozenite plugin.`);
    }

    plugins.push(plugin);
  }

  return plugins;
};

export const getInstalledPlugins = async (options: RozeniteConfig): Promise<InstalledPlugin[]> => {
  if (options.include) {
    logger.info('Auto-discovery is disabled. Using only included plugins.');
    return getIncludedPlugins(options);
  }

  return getInstalledPluginsFromDependencies(options);
};

const readDependencyNames = async (projectRoot: string): Promise<string[]> => {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

  return Array.from(
    new Set([
      ...Object.keys(packageJson.dependencies || {}),
      ...Object.keys(packageJson.devDependencies || {}),
    ]),
  );
};

const resolveInstalledPlugin = async (
  projectRoot: string,
  dependency: string,
): Promise<InstalledPlugin | null> => {
  const packagePath = await resolvePackageRoot(projectRoot, dependency);

  if (!packagePath) {
    return null;
  }

  return tryExtractPlugin(packagePath, dependency);
};

const getInstalledPluginsFromDependencies = async (
  options: RozeniteConfig,
): Promise<InstalledPlugin[]> => {
  const dependencies = (await readDependencyNames(options.projectRoot)).filter(
    (dependency) => !options.exclude?.includes(dependency),
  );

  const limit = createLimiter(DISCOVERY_CONCURRENCY);
  const plugins = await Promise.all(
    dependencies.map((dependency) =>
      limit(() => resolveInstalledPlugin(options.projectRoot, dependency)),
    ),
  );

  return plugins.filter((plugin): plugin is InstalledPlugin => plugin !== null);
};
