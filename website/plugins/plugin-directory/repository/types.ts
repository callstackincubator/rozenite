import { PluginDirectoryReference, RozenitePluginEntry } from '../types';

export interface PluginRepository {
  getPlugin(packageName: string): Promise<RozenitePluginEntry | null>;
  getPlugins(packageNames: string[]): Promise<RozenitePluginEntry[]>;
  refreshPlugin(plugin: PluginDirectoryReference): Promise<RozenitePluginEntry>;
  getPluginWithFallback(
    plugin: PluginDirectoryReference
  ): Promise<RozenitePluginEntry>;
  getExpiredPlugins(packageNames: string[]): Promise<string[]>;
  cleanupExpired(): Promise<void>;
}
