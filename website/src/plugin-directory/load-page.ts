import { getPluginReferences, getPlugins } from './data-source';
import type { PluginDirectoryPage, PluginDirectoryReference } from './types';

export const PLUGINS_PER_PAGE = 12;

let references: PluginDirectoryReference[] | null = null;

const getReferences = async () => {
  if (references) return references;
  try {
    references = await getPluginReferences();
    return references;
  } catch (error) {
    console.error('Failed to load plugin references:', error);
    return [];
  }
};

export const getTotalPages = async () =>
  Math.max(1, Math.ceil((await getReferences()).length / PLUGINS_PER_PAGE));

export const loadPluginDirectoryPage = async (pageNumber: number): Promise<PluginDirectoryPage> => {
  const all = await getReferences();
  const totalPages = Math.max(1, Math.ceil(all.length / PLUGINS_PER_PAGE));
  const start = (pageNumber - 1) * PLUGINS_PER_PAGE;

  try {
    const data = await getPlugins(all.slice(start, start + PLUGINS_PER_PAGE));
    return { pageNumber, totalPages, data };
  } catch (error) {
    console.error('Failed to fetch plugins data:', error);
    return { pageNumber, totalPages, data: [] };
  }
};
