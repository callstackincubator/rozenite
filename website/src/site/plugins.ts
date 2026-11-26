// The official plugins, built from their docs pages: each page under official-plugins/ with
// `plugin` frontmatter becomes a page at /plugins/<slug> and a cell on the home page.
import { getCollection } from 'astro:content';

import { pluginOrder } from './content';
import { pluginPage, sortPlugins, type PluginPage } from './plugin-docs';

const DIR = 'docs/official-plugins/';

export async function getPlugins(): Promise<(PluginPage & { body: string })[]> {
  const entries = await getCollection(
    'docs',
    (e) => e.id.startsWith(DIR) && e.data.plugin !== undefined,
  );
  return sortPlugins(
    entries.map((e) => ({
      ...pluginPage(e.id.slice(DIR.length), e.data.title, e.body ?? '', e.data.plugin!),
      body: e.body ?? '',
    })),
    pluginOrder,
  );
}
