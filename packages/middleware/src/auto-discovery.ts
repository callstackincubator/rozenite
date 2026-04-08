import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { logger } from './logger.js';
import { ROZENITE_MANIFEST } from './constants.js';
import { RozeniteConfig } from './config.js';

const require = createRequire(import.meta.url);

export type InstalledPlugin = {
  name: string;
  path: string;
};

const readPackageJsonName = (packagePath: string): string | null => {
  try {
    const packageJsonPath = path.join(packagePath, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return typeof packageJson.name === 'string' ? packageJson.name : null;
  } catch {
    return null;
  }
};

export const findPackageRoot = (
  packageName: string,
  resolvedPath: string
): string | null => {
  let currentPath = path.dirname(resolvedPath);

  while (true) {
    if (readPackageJsonName(currentPath) === packageName) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);

    if (parentPath === currentPath) {
      return null;
    }

    currentPath = parentPath;
  }
};

const resolvePackageRoot = (
  projectRoot: string,
  packageName: string
): string | null => {
  try {
    const resolvedPath = require.resolve(packageName, { paths: [projectRoot] });
    return findPackageRoot(packageName, resolvedPath);
  } catch {
    return null;
  }
};

const tryResolvePlugin = (
  projectRoot: string,
  maybePlugin: string
): string | null => {
  return resolvePackageRoot(projectRoot, maybePlugin);
};

const getIncludedPlugins = (options: RozeniteConfig): InstalledPlugin[] => {
  assert(options.include, 'include is required');

  const plugins: InstalledPlugin[] = [];
  const normalizedInclude = options.exclude
    ? options.include.filter((plugin) => !options.exclude?.includes(plugin))
    : options.include;

  for (const maybePlugin of normalizedInclude) {
    const pluginPath = tryResolvePlugin(options.projectRoot, maybePlugin);

    if (!pluginPath) {
      throw new Error(`Could not resolve plugin ${maybePlugin}.`);
    }

    const plugin = tryExtractPlugin(pluginPath, maybePlugin);

    if (!plugin) {
      throw new Error(`Plugin ${maybePlugin} is not a valid Rozenite plugin.`);
    }

    plugins.push(plugin);
  }

  return plugins;
};

export const getInstalledPlugins = (
  options: RozeniteConfig
): InstalledPlugin[] => {
  if (options.include) {
    logger.info('Auto-discovery is disabled. Using only included plugins.');
    return getIncludedPlugins(options);
  }

  return getInstalledPluginsFromDependencies(options);
};

const getInstalledPluginsFromDependencies = (
  options: RozeniteConfig
): InstalledPlugin[] => {
  const plugins: InstalledPlugin[] = [];
  const packageJsonPath = path.join(options.projectRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  const dependencies = Array.from(new Set([
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
  ]));

  for (const dependency of dependencies) {
    if (options.exclude?.includes(dependency)) {
      continue;
    }

    const packagePath = resolvePackageRoot(options.projectRoot, dependency);

    if (!packagePath) {
      continue;
    }

    const plugin = tryExtractPlugin(packagePath, dependency);

    if (plugin) {
      plugins.push(plugin);
    }
  }

  return plugins;
};

const tryExtractPlugin = (
  packagePath: string,
  packageName: string
): InstalledPlugin | null => {
  const rozeniteConfigPath = path.join(packagePath, 'dist', ROZENITE_MANIFEST);

  try {
    fs.accessSync(rozeniteConfigPath);
  } catch {
    return null;
  }

  return {
    name: packageName,
    path: packagePath,
  };
};
