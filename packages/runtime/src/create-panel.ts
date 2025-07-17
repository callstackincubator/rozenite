import { getPluginView } from './rn-devtools/plugin-view.js';
import { UI } from './rn-devtools/rn-devtools-frontend.js';

const toExtendedKebabCase = (input: string): string => {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '');
};

export const createPanel = (pluginId: string, name: string, url: string) => {
  try {
    const pluginIdKebab = toExtendedKebabCase(pluginId);
    const nameKebab = toExtendedKebabCase(name);
    const panelId = `${pluginIdKebab}.${nameKebab}`;

    if (UI.InspectorView.InspectorView.instance().hasPanel(panelId)) {
      return;
    }

    const panelView = getPluginView(panelId, name, url);

    UI.InspectorView.InspectorView.instance().addPanel(panelView);
  } catch (err) {
    console.error(err);
    throw err;
  }
};
