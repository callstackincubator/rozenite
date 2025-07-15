import { getPluginView } from '../rn-devtools/plugin-view.js';
import { getPluginScopedUrl } from '../plugin-loader.js';
import { UI } from '../rn-devtools/rn-devtools-frontend.js';

export const getCreatePanelCommandHandler =
  (pluginId: string) => (name: string, url: string) => {
    try {
      const panelId = `${pluginId.replace('/', '-').replace('@', '')}-${name
        .toLocaleLowerCase()
        .replace(/ /g, '-')}`;
      const panelUrl = getPluginScopedUrl(pluginId, url);

      if (UI.InspectorView.InspectorView.instance().hasPanel(panelId)) {
        return;
      }

      const panelView = getPluginView(panelId, name, panelUrl);

      UI.InspectorView.InspectorView.instance().addPanel(panelView);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };
