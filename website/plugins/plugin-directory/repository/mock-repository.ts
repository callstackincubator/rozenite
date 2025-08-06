import { PluginRepository } from './types';
import { PluginDirectoryReference, RozenitePluginEntry } from '../types';
import { extractPackageNameFromNpmUrl } from '../utils';

const MOCK_PLUGINS: RozenitePluginEntry[] = [
  {
    packageName: '@rozenite/redux-devtools-plugin',
    version: '1.2.3',
    githubUrl:
      'https://github.com/callstackincubator/rozenite/tree/main/packages/redux-devtools-plugin',
    npmUrl: 'https://www.npmjs.com/package/@rozenite/redux-devtools-plugin',
    description:
      'Redux DevTools integration for React Native development with Rozenite',
    stars: 156,
    isOfficial: true,
  },
  {
    packageName: '@rozenite/network-activity-plugin',
    version: '2.1.0',
    githubUrl:
      'https://github.com/callstackincubator/rozenite/tree/main/packages/network-activity-plugin',
    npmUrl: 'https://www.npmjs.com/package/@rozenite/network-activity-plugin',
    description:
      'Network activity monitoring and debugging for React Native apps',
    stars: 89,
    isOfficial: true,
  },
  {
    packageName: '@rozenite/mmkv-plugin',
    version: '1.0.5',
    githubUrl:
      'https://github.com/callstackincubator/rozenite/tree/main/packages/mmkv-plugin',
    npmUrl: 'https://www.npmjs.com/package/@rozenite/mmkv-plugin',
    description: 'MMKV storage debugging and inspection tools for React Native',
    stars: 234,
    isOfficial: true,
  },
  {
    packageName: '@rozenite/tanstack-query-plugin',
    version: '1.8.2',
    githubUrl:
      'https://github.com/callstackincubator/rozenite/tree/main/packages/tanstack-query-plugin',
    npmUrl: 'https://www.npmjs.com/package/@rozenite/tanstack-query-plugin',
    description: 'TanStack Query cache inspection and debugging utilities',
    stars: 178,
    isOfficial: true,
  },
  {
    packageName: '@rozenite/expo-atlas-plugin',
    version: '1.5.1',
    githubUrl:
      'https://github.com/callstackincubator/rozenite/tree/main/packages/expo-atlas-plugin',
    npmUrl: 'https://www.npmjs.com/package/@rozenite/expo-atlas-plugin',
    description: 'Expo Atlas integration for React Native development tools',
    stars: 67,
    isOfficial: true,
  },
];

export class MockPluginRepository implements PluginRepository {
  private plugins = new Map<string, RozenitePluginEntry>();

  constructor() {
    // Initialize the mock data
    MOCK_PLUGINS.forEach((plugin) => {
      this.plugins.set(plugin.packageName, plugin);
    });
  }

  async getPlugin(packageName: string): Promise<RozenitePluginEntry | null> {
    return this.plugins.get(packageName) || null;
  }

  async getPlugins(packageNames: string[]): Promise<RozenitePluginEntry[]> {
    return packageNames
      .map((name) => this.plugins.get(name))
      .filter((plugin): plugin is RozenitePluginEntry => plugin !== undefined);
  }

  async refreshPlugin(
    plugin: PluginDirectoryReference
  ): Promise<RozenitePluginEntry> {
    // Extract package name from npm URL
    const packageName = extractPackageNameFromNpmUrl(plugin.npmUrl);

    if (!packageName) {
      throw new Error(`Invalid NPM URL: ${plugin.npmUrl}`);
    }

    const existingPlugin = this.plugins.get(packageName);

    if (!existingPlugin) {
      throw new Error(`Plugin not found: ${packageName}`);
    }

    // Simulate a refresh by returning the same data (in a real implementation, this would fetch fresh data)
    return existingPlugin;
  }

  async getPluginWithFallback(
    plugin: PluginDirectoryReference
  ): Promise<RozenitePluginEntry> {
    const packageName = extractPackageNameFromNpmUrl(plugin.npmUrl);

    if (!packageName) {
      throw new Error(`Invalid NPM URL: ${plugin.npmUrl}`);
    }

    const existingPlugin = this.plugins.get(packageName);

    if (!existingPlugin) {
      // Create a fallback plugin entry
      return {
        packageName,
        version: '0.0.0',
        githubUrl: plugin.githubUrl,
        npmUrl: plugin.npmUrl,
        description: 'Plugin information not available',
        stars: 0,
        isOfficial: false,
      };
    }

    return existingPlugin;
  }

  async getExpiredPlugins(): Promise<string[]> {
    // In a mock implementation, we'll return an empty array
    // In a real implementation, this would check cache expiration
    return [];
  }

  async cleanupExpired(): Promise<void> {
    // In a mock implementation, this is a no-op
    // In a real implementation, this would clean up expired cache entries
  }
}
