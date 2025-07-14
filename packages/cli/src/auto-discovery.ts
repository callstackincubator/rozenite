import fs from 'node:fs/promises';
import path from 'node:path';
import { InstalledPlugin } from './types.js';
import { logger } from './utils/logger.js';

/**
 * Checks if a path is a directory or a symbolic link pointing to a directory
 */
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

    // Check if it's a symbolic link
    if (stats.isSymbolicLink()) {
      // Follow the symbolic link and check if it points to a directory
      const realPath = await fs.realpath(filePath);
      const realStats = await fs.stat(realPath);
      return realStats.isDirectory();
    } else {
      // Regular directory
      return stats.isDirectory();
    }
  } catch (error) {
    // Skip if we can't access the path (permissions, broken symlink, etc.)
    logger.warn(`Warning: Could not access ${filePath}:`, error);
    return false;
  }
};

export const getInstalledPlugins = async (
  nodeModulesPaths: readonly string[]
): Promise<InstalledPlugin[]> => {
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
  const packageJsonPath = path.join(packagePath, 'package.json');

  try {
    await fs.access(packageJsonPath);
  } catch {
    return null;
  }

  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);

    const devtoolsPluginPath = packageJson.rozenite;

    if (devtoolsPluginPath == null) {
      return null;
    }

    return {
      id: packageName,
    };
  } catch {
    return null;
  }
};
