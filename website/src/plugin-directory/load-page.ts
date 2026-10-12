import { getPluginReferences, getPlugins } from './data-source';
import type { PluginDirectoryPage, ValidatedPluginReference } from './types';

export const PLUGINS_PER_PAGE = 12;

let references: Promise<ValidatedPluginReference[]> | null = null;

// An invalid `plugin-directory.json` throws here and fails the build.
const getReferences = () => (references ??= getPluginReferences());

export const getTotalPages = async () =>
  Math.max(1, Math.ceil((await getReferences()).length / PLUGINS_PER_PAGE));

export const loadPluginDirectoryPage = async (pageNumber: number): Promise<PluginDirectoryPage> => {
  const all = await getReferences();
  const totalPages = Math.max(1, Math.ceil(all.length / PLUGINS_PER_PAGE));
  const start = (pageNumber - 1) * PLUGINS_PER_PAGE;

  // Strict builds let a load failure propagate and fail `astro build`; otherwise `getPlugins`
  // has already degraded each failing card.
  const data = await getPlugins(all.slice(start, start + PLUGINS_PER_PAGE));
  return { pageNumber, totalPages, data };
};
