import { getPluginView } from '../rn-devtools/plugin-view.js';
import { PluginInstance } from '../types.js';
import { getPluginScopedUrl } from '../plugin-loader.js';
import { UI } from '../rn-devtools/rn-devtools-frontend.js';

export const getCreatePanelCommandHandler =
  (plugin: PluginInstance) => (name: string, url: string) => {
    const panelId = `${plugin.id}-${name}`;
    const panelUrl = getPluginScopedUrl(plugin.id, url);

    if (UI.InspectorView.InspectorView.instance().hasPanel(panelId)) {
      return;
    }

    const panelView = getPluginView(plugin, panelId, name, panelUrl);
    UI.InspectorView.InspectorView.instance().addPanel(panelView);
  };
