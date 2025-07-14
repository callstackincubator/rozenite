import fs from 'node:fs/promises';
import path from 'node:path';
import { getInstalledPlugins } from './auto-discovery.js';
import { getNodeModulesPaths } from './node-modules-paths.js';
import { InstalledPlugin } from './types.js';
import { logger } from './utils/logger.js';

export interface PluginRegistry {
  plugins: InstalledPlugin[];
  lastUpdated: string;
  nodeModulesPaths: readonly string[];
}

const REGISTRY_DIR = path.join(
  process.cwd(),
  'node_modules',
  '.cache',
  'rozenite'
);
const REGISTRY_FILE = path.join(REGISTRY_DIR, 'plugin-registry.json');

const ensureRegistryDirectory = async (): Promise<void> => {
  try {
    await fs.access(REGISTRY_DIR);
  } catch {
    await fs.mkdir(REGISTRY_DIR, { recursive: true });
  }
};

export const loadPluginRegistry = async (): Promise<PluginRegistry> => {
  await ensureRegistryDirectory();

  try {
    await fs.access(REGISTRY_FILE);
  } catch {
    return {
      plugins: [],
      lastUpdated: new Date().toISOString(),
      nodeModulesPaths: [],
    };
  }

  try {
    const registryContent = await fs.readFile(REGISTRY_FILE, 'utf8');
    return JSON.parse(registryContent);
  } catch (error) {
    logger.warn('Failed to load plugin registry:', error);
    return {
      plugins: [],
      lastUpdated: new Date().toISOString(),
      nodeModulesPaths: [],
    };
  }
};

export const savePluginRegistry = async (
  registry: PluginRegistry
): Promise<void> => {
  await ensureRegistryDirectory();

  try {
    await fs.writeFile(REGISTRY_FILE, JSON.stringify(registry, null, 2));
  } catch (error) {
    logger.error('Failed to save plugin registry:', error);
  }
};

export const updatePluginRegistry = async (): Promise<PluginRegistry> => {
  const nodeModulesPaths = getNodeModulesPaths();
  const plugins = await getInstalledPlugins(nodeModulesPaths);

  const registry: PluginRegistry = {
    plugins,
    lastUpdated: new Date().toISOString(),
    nodeModulesPaths,
  };

  await savePluginRegistry(registry);
  return registry;
};

export const getPluginRegistry = async (): Promise<PluginRegistry> => {
  const registry = await loadPluginRegistry();

  // Check if we need to update the registry
  const currentNodeModulesPaths = getNodeModulesPaths();
  const pathsChanged =
    registry.nodeModulesPaths.length !== currentNodeModulesPaths.length ||
    !registry.nodeModulesPaths.every(
      (path, index) => path === currentNodeModulesPaths[index]
    );

  if (pathsChanged) {
    logger.info('Node modules paths changed, updating plugin registry...');
    return await updatePluginRegistry();
  }

  return registry;
};

export const clearPluginRegistry = async (): Promise<void> => {
  try {
    await fs.access(REGISTRY_FILE);
    await fs.unlink(REGISTRY_FILE);
    logger.info('Plugin registry cleared');
  } catch (error) {
    logger.error('Failed to clear plugin registry:', error);
  }
};
