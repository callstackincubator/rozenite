import { createPanel } from './create-panel';

export const getPluginScopedUrl = (pluginId: string, path: string) => {
  const url = new URL(location.href);
  url.search = '';
  url.pathname = `/rozenite/plugins/${pluginId.replace('/', '_')}/${path}`;
  return url.toString();
};

export type RozeniteManifest = {
  panels: {
    name: string;
    source: string;
  }[];
};

const getRozeniteManifest = async (
  pluginId: string
): Promise<RozeniteManifest> => {
  const rozeniteManifest = getPluginScopedUrl(pluginId, 'rozenite.json');
  const response = await fetch(rozeniteManifest);
  return response.json();
};

export const loadPlugin = async (pluginId: string): Promise<void> => {
  const rozeniteManifest = await getRozeniteManifest(pluginId);
  rozeniteManifest.panels.forEach((panel) => {
    createPanel(pluginId, panel.name, panel.source);
  });
};
