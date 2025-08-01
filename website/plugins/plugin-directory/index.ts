import type { RspressPlugin } from '@rspress/shared';
import * as path from 'node:path';
import { getPluginReferences, getPlugins } from './data-source';
import { PluginDirectoryReference } from './types';

const PLUGINS_PER_PAGE = 12;

export const pluginDirectoryPlugin = (): RspressPlugin => {
  let allPluginsReferences: PluginDirectoryReference[] | null = null;

  const getPluginsReferences = async () => {
    if (allPluginsReferences) {
      return allPluginsReferences;
    }

    try {
      allPluginsReferences = await getPluginReferences();
      return allPluginsReferences;
    } catch (error) {
      console.error('Failed to load plugin references:', error);
      return [];
    }
  };

  return {
    name: 'plugin-directory',
    async extendPageData(pageData) {
      if (!pageData.routePath.includes('/plugin-directory')) {
        return;
      }

      const page = pageData.routePath.split('/').pop();
      let pageNumber = parseInt(page || '1');

      if (isNaN(pageNumber) || pageNumber < 1) {
        pageNumber = 1;
      }

      const startIndex = (pageNumber - 1) * PLUGINS_PER_PAGE;
      const endIndex = startIndex + PLUGINS_PER_PAGE;
      const allPluginsReferences = await getPluginsReferences();
      const totalPages = Math.ceil(
        allPluginsReferences.length / PLUGINS_PER_PAGE
      );

      try {
        const data = await getPlugins(
          allPluginsReferences.slice(startIndex, endIndex)
        );

        pageData.pluginDirectoryPage = {
          pageNumber,
          totalPages: Math.max(1, totalPages),
          data,
        };
      } catch (error) {
        console.error('Failed to fetch plugins data:', error);
        pageData.pluginDirectoryPage = {
          pageNumber,
          totalPages: 1,
          data: [],
        };
      }
    },
    async addPages() {
      const allPluginsReferences = await getPluginsReferences();
      const pages = [];
      const totalPages = Math.ceil(
        allPluginsReferences.length / PLUGINS_PER_PAGE
      );

      pages.push({
        routePath: '/plugin-directory',
        filepath: path.join(
          __dirname,
          `plugin-directory-page/plugin-directory-page.tsx`
        ),
      });

      for (let page = 1; page <= totalPages; page++) {
        pages.push({
          routePath: `/plugin-directory/${page}`,
          filepath: path.join(
            __dirname,
            `plugin-directory-page/plugin-directory-page.tsx`
          ),
        });
      }

      return pages;
    },
  };
};
