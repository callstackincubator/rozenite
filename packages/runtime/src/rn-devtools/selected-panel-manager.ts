import { TabbedPaneEventDataMap } from './rn-devtools-frontend-api.js';
import { UI } from './rn-devtools-frontend.js';

const STORAGE_KEY = '__rozenite_selected_panel__';

const onTabSelected = (event: TabbedPaneEventDataMap['TabSelected']) => {
  const panelId = event.data.tabId;

  if (panelId) {
    saveSelectedPanelId(panelId);
  }
};

function saveSelectedPanelId(panelId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, panelId);
  } catch (error) {
    console.warn('Could not save selected panel:', error);
  }
}

function getSelectedPanelId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function switchToSelectedPanel(): void {
  const lastPanelId = getSelectedPanelId();

  if (lastPanelId) {
    try {
      UI.InspectorView.InspectorView.instance().tabbedPane.selectTab(
        lastPanelId
      );
    } catch (error) {
      console.warn('Could not restore last selected panel:', error);
    }
  }
}

export function trackPanelSelection() {
  try {
    const tabbedPane = UI.InspectorView.InspectorView.instance().tabbedPane;

    tabbedPane.addEventListener('TabSelected', onTabSelected);
  } catch (error) {
    console.error('Could not initialize tab selected tracking:', error);
  }
}
