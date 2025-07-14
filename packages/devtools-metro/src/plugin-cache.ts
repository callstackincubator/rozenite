import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from './logger.js';

export interface PluginApprovalCache {
  approvedPlugins: string[];
  lastUpdated: string;
}

const CACHE_DIR = 'node_modules/.cache/rozenite';
const CACHE_FILE = path.join(CACHE_DIR, 'plugin-approval.json');

export const getCachePath = (): string => {
  return CACHE_FILE;
};

export const ensureCacheDirectory = async (): Promise<void> => {
  try {
    await fs.access(CACHE_DIR);
  } catch {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  }
};

export const loadPluginApprovalCache =
  async (): Promise<PluginApprovalCache> => {
    await ensureCacheDirectory();

    try {
      const cacheContent = await fs.readFile(CACHE_FILE, 'utf8');
      return JSON.parse(cacheContent);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          approvedPlugins: [],
          lastUpdated: new Date().toISOString(),
        };
      }
      logger.warn('Failed to load plugin approval cache:', error);
      return {
        approvedPlugins: [],
        lastUpdated: new Date().toISOString(),
      };
    }
  };

export const savePluginApprovalCache = async (
  cache: PluginApprovalCache
): Promise<void> => {
  await ensureCacheDirectory();

  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    logger.error('Failed to save plugin approval cache:', error);
  }
};

export const addApprovedPlugin = async (pluginId: string): Promise<void> => {
  const cache = await loadPluginApprovalCache();

  if (!cache.approvedPlugins.includes(pluginId)) {
    cache.approvedPlugins.push(pluginId);
    cache.lastUpdated = new Date().toISOString();
    await savePluginApprovalCache(cache);
  }
};

export const removeApprovedPlugin = async (pluginId: string): Promise<void> => {
  const cache = await loadPluginApprovalCache();

  const index = cache.approvedPlugins.indexOf(pluginId);
  if (index > -1) {
    cache.approvedPlugins.splice(index, 1);
    cache.lastUpdated = new Date().toISOString();
    await savePluginApprovalCache(cache);
  }
};

export const isPluginApproved = async (pluginId: string): Promise<boolean> => {
  const cache = await loadPluginApprovalCache();
  return cache.approvedPlugins.includes(pluginId);
};

export const getApprovedPlugins = async (): Promise<string[]> => {
  const cache = await loadPluginApprovalCache();
  return [...cache.approvedPlugins];
};

export const clearApprovalCache = async (): Promise<void> => {
  try {
    await fs.access(CACHE_FILE);
    await fs.unlink(CACHE_FILE);
    logger.info('Plugin approval cache cleared');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error('Failed to clear plugin approval cache:', error);
    }
  }
};

export const getCacheInfo = async (): Promise<{
  path: string;
  exists: boolean;
  size?: number;
}> => {
  let exists = false;
  let size: number | undefined;

  try {
    await fs.access(CACHE_FILE);
    exists = true;
    const stats = await fs.stat(CACHE_FILE);
    size = stats.size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn('Failed to get cache file stats:', error);
    }
  }

  return {
    path: CACHE_FILE,
    exists,
    size,
  };
};
