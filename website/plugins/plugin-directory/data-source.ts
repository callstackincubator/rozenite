import * as path from 'node:path';
import * as fs from 'node:fs';
import { getRepository } from './repository/repository-factory';
import { PluginDirectoryReference, RozenitePluginEntry } from './types';
import {
  getPackageNamesFromReferences,
  extractPackageNameFromNpmUrl,
} from './utils';

export const getPluginReferences = async (): Promise<
  PluginDirectoryReference[]
> => {
  try {
    const plugins = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../../../plugin-directory.json'),
        'utf8'
      )
    );

    return plugins;
  } catch (error) {
    throw new Error(
      `Failed to read plugin directory: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
};

export const getPlugins = async (
  references: PluginDirectoryReference[]
): Promise<RozenitePluginEntry[]> => {
  try {
    const repository = await getRepository();
    const packageNames = getPackageNamesFromReferences(references);

    const cachedPlugins = await repository.getPlugins(packageNames);
    const cachedPackageNames = new Set(cachedPlugins.map((p) => p.packageName));
    console.log(
      `Found ${cachedPlugins.length} of ${packageNames.length} plugins in cache`
    );

    const pluginsToFetch = references.filter((ref) => {
      const packageName = extractPackageNameFromNpmUrl(ref.npmUrl);
      return packageName && !cachedPackageNames.has(packageName);
    });

    console.log(
      `Fetching missing ${pluginsToFetch.length} of ${packageNames.length} plugins`
    );
    const fetchedPlugins = await Promise.all(
      pluginsToFetch.map((ref) => repository.getPluginWithFallback(ref))
    );

    const allPlugins = [...cachedPlugins, ...fetchedPlugins];

    await repository.cleanupExpired();

    return allPlugins;
  } catch (error) {
    throw new Error(
      `Failed to fetch plugins data: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
};
