import { createPanel } from './create-panel';
import { getManifest } from './manifest';

const getPluginUrl = (pluginId: string) => {
  const url = new URL(location.href);
  url.search = '';
  url.pathname = '/rozenite/plugins/' + pluginId.replace('/', '_');
  return url.toString();
};

export const loadPluginFromUrl = async (url: string): Promise<void> => {
  const manifest = await getManifest(url);
  manifest.panels.forEach((panel) => {
    const panelUrl = url + panel.source;
    createPanel(manifest.name, panel.name, panelUrl);
  });

  console.groupCollapsed(`📦 Plugin: ${manifest.name}`);
  console.log('Version:', manifest.version);
  console.log('Description:', manifest.description);
  console.log('Panels:', manifest.panels.map((panel) => panel.name).join(', '));
  console.groupEnd();
};

export const loadPlugin = async (pluginId: string): Promise<void> => {
  await loadPluginFromUrl(getPluginUrl(pluginId));
};
