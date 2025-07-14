import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from './logger.js';

export interface InstalledPlugin {
  id: string;
}

export interface PluginRegistry {
  plugins: InstalledPlugin[];
  lastUpdated: string;
  nodeModulesPaths: readonly string[];
}

const REGISTRY_FILE = path.join(
  process.cwd(),
  'node_modules',
  '.cache',
  'rozenite',
  'plugin-registry.json'
);

export const loadPluginRegistry = async (): Promise<PluginRegistry | null> => {
  try {
    const registryContent = await fs.readFile(REGISTRY_FILE, 'utf8');
    return JSON.parse(registryContent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    } else {
      logger.warn('Failed to load plugin registry:', error);
      throw error;
    }
  }
};

export const getInstalledPluginsFromRegistry = async (): Promise<
  string[] | null
> => {
  const registry = await loadPluginRegistry();

  if (!registry) {
    return null;
  }

  return registry.plugins.map((plugin) => plugin.id);
};
