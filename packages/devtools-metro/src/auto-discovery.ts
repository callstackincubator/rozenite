import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from './logger.js';
import { getNodeModulesPaths } from './node-modules-paths.js';

export type InstalledPlugin = {
  name: string;
  path: string;
};

const isDirectoryOrSymlinkToDirectory = async (
  filePath: string
): Promise<boolean> => {
  try {
    await fs.access(filePath);
  } catch {
    return false;
  }

  try {
    const stats = await fs.lstat(filePath);

    if (stats.isSymbolicLink()) {
      const realPath = await fs.realpath(filePath);
      const realStats = await fs.stat(realPath);
      return realStats.isDirectory();
    } else {
      return stats.isDirectory();
    }
  } catch (error) {
    logger.warn(`Warning: Could not access ${filePath}:`, error);
    return false;
  }
};

export const getInstalledPlugins = async (): Promise<InstalledPlugin[]> => {
  const nodeModulesPaths = getNodeModulesPaths();
  const plugins: InstalledPlugin[] = [];

  for (const nodeModulesPath of nodeModulesPaths) {
    try {
      await fs.access(nodeModulesPath);
    } catch {
      continue;
    }

    try {
      const entries = await fs.readdir(nodeModulesPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        if (
          !(await isDirectoryOrSymlinkToDirectory(
            path.join(nodeModulesPath, entry.name)
          ))
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
            await fs.access(scopePath);
          } catch {
            continue;
          }

          try {
            const scopedEntries = await fs.readdir(scopePath, {
              withFileTypes: true,
            });

            for (const scopedEntry of scopedEntries) {
              if (
                !(await isDirectoryOrSymlinkToDirectory(
                  path.join(scopePath, scopedEntry.name)
                ))
              ) {
                continue;
              }

              packagePath = path.join(scopePath, scopedEntry.name);
              actualPackageName = `${packageName}/${scopedEntry.name}`;

              const plugin = await tryExtractPlugin(
                packagePath,
                actualPackageName
              );
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

          const plugin = await tryExtractPlugin(packagePath, actualPackageName);
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

const tryExtractPlugin = async (
  packagePath: string,
  packageName: string
): Promise<InstalledPlugin | null> => {
  const rozeniteConfigPath = path.join(packagePath, 'dist', 'rozenite.json');

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
