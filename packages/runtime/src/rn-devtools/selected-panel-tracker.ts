import { UI } from './rn-devtools-frontend.js';

/**
 * Inspector device ID is combination of the app's bundle ID and the device's unique ID.
 * 
 * See:
 * https://github.com/facebook/react-native/blob/c7591d9b40babc8c4a57a03adee158bde3b10a06/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/devsupport/DevServerHelper.kt#L102-L124
 * https://github.com/facebook/react-native/blob/c7591d9b40babc8c4a57a03adee158bde3b10a06/packages/react-native/React/DevSupport/RCTInspectorDevServerHelper.mm#L77-L99
 */
const extractInspectorDeviceIdFromUrl = () => {
  try {
    const match = decodeURIComponent(window.location.href).match(
      /[?&]device=([^&]+)/
    );

    return match ? match[1] : null;
  } catch {
    return null;
  }
};

const getScopedStorageKey = () => {
  const inspectorDeviceId = extractInspectorDeviceIdFromUrl();

  if (!inspectorDeviceId) {
    throw new Error('Device ID not found');
  }

  return `rozenite::selected-panel::${inspectorDeviceId}`;
};

const saveSelectedPanelId = (panelId: string) => {
  try {
    const storageKey = getScopedStorageKey();

    localStorage.setItem(storageKey, panelId);
  } catch (error) {
    console.warn('Could not save selected panel:', error);
  }
};

const getSelectedPanelId = () => {
  try {
    const storageKey = getScopedStorageKey();

    return localStorage.getItem(storageKey);
  } catch (error) {
    console.warn('Could not get selected panel:', error);

    return null;
  }
};

export const switchToSelectedPanel = () => {
  const lastPanelId = getSelectedPanelId();

  if (!lastPanelId) {
    return;
  }

  try {
    UI.InspectorView.InspectorView.instance().tabbedPane.selectTab(lastPanelId);
  } catch (error) {
    console.warn('Could not restore last selected panel:', error);
  }
};

export const trackPanelSelection = () => {
  try {
    const tabbedPane = UI.InspectorView.InspectorView.instance().tabbedPane;

    tabbedPane.addEventListener('TabSelected', (event) => {
      const panelId = event.data.tabId;

      if (panelId) {
        saveSelectedPanelId(panelId);
      }
    });
  } catch (error) {
    console.error('Could not initialize tab selected tracking:', error);
  }
};
