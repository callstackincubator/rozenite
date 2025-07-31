import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { logger } from './logger.js';
import { getNodeModulesPaths } from './node-modules-paths.js';
import { ROZENITE_MANIFEST } from './constants.js';
import { RozeniteConfig } from './config.js';

const require = createRequire(import.meta.url);

export type InstalledPlugin = {
  name: string;
  path: string;
};

const isDirectoryOrSymlinkToDirectory = (filePath: string): boolean => {
  try {
    fs.accessSync(filePath);
  } catch {
    return false;
  }

  try {
    const stats = fs.lstatSync(filePath);

    if (stats.isSymbolicLink()) {
      const realPath = fs.realpathSync(filePath);
      const realStats = fs.statSync(realPath);
      return realStats.isDirectory();
    } else {
      return stats.isDirectory();
    }
  } catch (error) {
    logger.warn(`Warning: Could not access ${filePath}:`, error);
    return false;
  }
};

const tryResolvePlugin = (
  projectRoot: string,
  maybePlugin: string
): string | null => {
  try {
    const pluginPath = require.resolve(maybePlugin, { paths: [projectRoot] });
    // lorem-ipsum/dist/index.js -> ../.. -> lorem-ipsum/
    return path.resolve(pluginPath, '..', '..');
  } catch {
    return null;
  }
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

  const nodeModulesPaths = getNodeModulesPaths();
  const plugins: InstalledPlugin[] = [];

  for (const nodeModulesPath of nodeModulesPaths) {
    try {
      fs.accessSync(nodeModulesPath);
    } catch {
      continue;
    }

    try {
      const entries = fs.readdirSync(nodeModulesPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        if (
          !isDirectoryOrSymlinkToDirectory(
            path.join(nodeModulesPath, entry.name)
          )
        ) {
          continue;
        }

        const packageName = entry.name;

        if (packageName.startsWith('.')) {
          continue;
        }

        let packagePath: string;
        let actualPackageName: string;

        if (packageName.startsWith('@')) {
          const scopePath = path.join(nodeModulesPath, packageName);

          try {
            fs.accessSync(scopePath);
          } catch {
            continue;
          }

          try {
            const scopedEntries = fs.readdirSync(scopePath, {
              withFileTypes: true,
            });

            for (const scopedEntry of scopedEntries) {
              if (
                !isDirectoryOrSymlinkToDirectory(
                  path.join(scopePath, scopedEntry.name)
                )
              ) {
                continue;
              }

              packagePath = path.join(scopePath, scopedEntry.name);
              actualPackageName = `${packageName}/${scopedEntry.name}`;

              const plugin = tryExtractPlugin(packagePath, actualPackageName);

              if (
                options.exclude &&
                options.exclude.includes(actualPackageName)
              ) {
                continue;
              }

              if (plugin) {
                plugins.push(plugin);
              }
            }
          } catch (error) {
            logger.warn(
              `Warning: Could not read scope directory ${scopePath}:`,
              error
            );
            continue;
          }
        } else {
          packagePath = path.join(nodeModulesPath, packageName);
          actualPackageName = packageName;

          const plugin = tryExtractPlugin(packagePath, actualPackageName);

          if (options.exclude && options.exclude.includes(actualPackageName)) {
            continue;
          }

          if (plugin) {
            plugins.push(plugin);
          }
        }
      }
    } catch (error) {
      logger.warn(
        `Warning: Could not read node_modules directory ${nodeModulesPath}:`,
        error
      );
      continue;
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
