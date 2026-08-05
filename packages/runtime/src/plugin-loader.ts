import { getManifest } from './manifest';

export type LoadedPlugin = {
  id: string;
  name: string;
  description: string;
  panels: {
    id: string;
    name: string;
    source: string;
  }[];
};

export const getPluginUrl = (pluginId: string) => {
  const url = new URL(location.href);
  url.search = '';
  url.pathname = '/rozenite/plugins/' + pluginId.replace('/', '_');
  return url.toString();
};

export const loadPluginFromUrl = async (
  url: string,
  pluginId?: string,
): Promise<LoadedPlugin> => {
  const manifest = await getManifest(url);
  const id = pluginId ?? manifest.name;

  console.groupCollapsed(`📦 Plugin: ${manifest.name}`);
  console.log('Version:', manifest.version);
  console.log('Description:', manifest.description);
  console.log('Panels:', manifest.panels.map((panel) => panel.name).join(', '));
  console.groupEnd();

  return {
    id,
    name: manifest.name,
    description: manifest.description,
    panels: manifest.panels.map((panel) => ({
      id: `${id}:${panel.name}`,
      name: panel.name,
      source: url + panel.source,
    })),
  };
};

export const loadPlugin = async (pluginId: string): Promise<LoadedPlugin> => {
  return loadPluginFromUrl(getPluginUrl(pluginId), pluginId);
};
