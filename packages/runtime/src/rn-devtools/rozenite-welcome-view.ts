import { getGlobalNamespace } from '../global-namespace.js';
import { UI } from './rn-devtools-frontend.js';

const WELCOME_VIEW_ID = 'rozenite-welcome';
const ROZENITE_WELCOME_URL = 'https://rozenite.dev/welcome';

class RozeniteWelcomeView extends UI.View.SimpleView {
  constructor() {
    super('Rozenite 💎', true, WELCOME_VIEW_ID);

    const { installedPlugins } = getGlobalNamespace();
    const hasInstalledPlugins = installedPlugins.length > 0;

    const url = new URL(ROZENITE_WELCOME_URL, window.location.origin);
    url.searchParams.set(
      'withPluginsInstalled',
      hasInstalledPlugins.toString()
    );

    const iframe = document.createElement('iframe');
    iframe.src = url.toString();
    iframe.style.height = '100%';
    iframe.style.width = '100%';
    this.contentElement.appendChild(iframe);
  }
}

export const addWelcomeView = (): void => {
  const welcomeView = new RozeniteWelcomeView();

  UI.InspectorView.InspectorView.instance().addPanel(welcomeView);

  const panelViewTab =
    UI.InspectorView.InspectorView.instance().tabbedPane.tabsById.get(
      WELCOME_VIEW_ID
    );

  if (!panelViewTab) {
    throw new Error('Welcome view tab not found.');
  }

  UI.InspectorView.InspectorView.instance().tabbedPane.insertBefore(
    panelViewTab,
    0
  );
  UI.InspectorView.InspectorView.instance().tabbedPane.selectTab(
    panelViewTab.id
  );
};
