import * as path from 'node:path';
import * as fs from 'node:fs';
import pThrottle from 'p-throttle';
import { extractPackageNameFromNpmUrl } from './clients/npm-client';
import { getBasicPackageInfo } from './clients/npm-client';
import {
  getRepositoryFromUrl,
  getRepositoryStars,
} from './clients/github-client';
import { PluginDirectoryReference, RozenitePluginEntry } from './types';

const throttle = pThrottle({
  limit: 16,
  interval: 1000,
});

const getPlugin = throttle(
  async (plugin: PluginDirectoryReference): Promise<RozenitePluginEntry> => {
    const githubRepository = getRepositoryFromUrl(plugin.githubUrl);
    const npmPackageName = extractPackageNameFromNpmUrl(plugin.npmUrl);

    if (!githubRepository || !npmPackageName) {
      throw new Error(
        `Invalid URLs for plugin: GitHub URL "${plugin.githubUrl}" or NPM URL "${plugin.npmUrl}"`
      );
    }

    try {
      const [stars, npmPackage] = await Promise.all([
        getRepositoryStars(githubRepository),
        getBasicPackageInfo(npmPackageName),
      ]);

      return {
        packageName: npmPackage.name,
        version: npmPackage.version,
        githubUrl: plugin.githubUrl,
        npmUrl: plugin.npmUrl,
        description: npmPackage.description,
        stars,
        isOfficial: npmPackage.name.startsWith('@rozenite/'),
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch data for plugin ${npmPackageName}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
);

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
    const plugins = await Promise.all(references.map(getPlugin));
    return plugins;
  } catch (error) {
    throw new Error(
      `Failed to fetch plugins data: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
};
