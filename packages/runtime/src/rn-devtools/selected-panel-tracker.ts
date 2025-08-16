import { UI, SDK } from './rn-devtools-frontend.js';

export class SelectedPanelTracker
  implements
    SDK.TargetManager
      .SDKModelObserver<SDK.ReactNativeApplicationModel.ReactNativeApplicationModel>
{
  static #instance: SelectedPanelTracker | null = null;

  #isLastSelectedPanelRestored = false;
  #isTrackingEnabled = false;
  #reactNativeMetadata: UI.Protocol.ReactNativeApplication.MetadataUpdatedEvent | null =
    null;

  static instance(): SelectedPanelTracker {
    if (!SelectedPanelTracker.#instance) {
      SelectedPanelTracker.#instance = new SelectedPanelTracker();
    }

    return SelectedPanelTracker.#instance;
  }

  startTracking() {
    if (this.#isTrackingEnabled) {
      return;
    }

    try {
      SDK.TargetManager.TargetManager.instance().observeModels(
        SDK.ReactNativeApplicationModel.ReactNativeApplicationModel,
        this
      );

      const tabbedPane = UI.InspectorView.InspectorView.instance().tabbedPane;
      tabbedPane.addEventListener('TabSelected', this.#handleTabSelected);

      this.#isTrackingEnabled = true;
    } catch (error) {
      console.error('Could not start tracking selected panels:', error);
    }
  }

  stopTracking() {
    if (!this.#isTrackingEnabled) {
      return;
    }

    try {
      const tabbedPane = UI.InspectorView.InspectorView.instance().tabbedPane;
      tabbedPane.removeEventListener('TabSelected', this.#handleTabSelected);

      this.#isTrackingEnabled = false;
    } catch (error) {
      console.warn('Could not stop tracking selected panels:', error);
    }
  }

  modelAdded(
    model: SDK.ReactNativeApplicationModel.ReactNativeApplicationModel
  ) {
    if (this.#isLastSelectedPanelRestored) {
      return;
    }

    model.ensureEnabled();

    if (model.metadataCached) {
      this.#handleMetadataUpdated({ data: model.metadataCached });
    } else {
      model.addEventListener(
        'MetadataUpdated',
        this.#handleMetadataUpdated,
        this
      );
    }
  }

  modelRemoved(
    model: SDK.ReactNativeApplicationModel.ReactNativeApplicationModel
  ) {
    model.removeEventListener(
      'MetadataUpdated',
      this.#handleMetadataUpdated,
      this
    );
  }

  #activateLastSelectedPanel() {
    try {
      if (this.#isLastSelectedPanelRestored) {
        return;
      }

      const lastPanelId = this.#getSelectedPanelId();

      if (!lastPanelId) {
        return;
      }

      UI.InspectorView.InspectorView.instance().tabbedPane.selectTab(
        lastPanelId
      );
    } catch (error) {
      console.warn('Could not restore last selected panel:', error);
    }
  }

  #handleMetadataUpdated(
    event: UI.Common.EventTarget.EventTargetEvent<UI.Protocol.ReactNativeApplication.MetadataUpdatedEvent>
  ) {
    this.#reactNativeMetadata = event.data;

    this.#activateLastSelectedPanel();

    this.#isLastSelectedPanelRestored = true;
  }

  #getConnectionId() {
    if (!this.#reactNativeMetadata) {
      throw new Error('React Native metadata is not available');
    }

    const { appIdentifier, deviceName } = this.#reactNativeMetadata;

    return [appIdentifier, deviceName].filter(Boolean).join('::');
  }

  #handleTabSelected = (
    event: UI.Common.EventTarget.EventTargetEvent<
      UI.TabbedPaneEventTypes['TabSelected']
    >
  ) => {
    const panelId = event.data.tabId;

    if (panelId) {
      this.#saveSelectedPanelId(panelId);
    }
  };

  #getScopedStorageKey(): string {
    const appId = this.#getConnectionId();

    return `rozenite::selected-panel::${appId}`;
  }

  #saveSelectedPanelId(panelId: string): void {
    try {
      const storageKey = this.#getScopedStorageKey();

      localStorage.setItem(storageKey, panelId);
    } catch (error) {
      console.warn('Could not save selected panel:', error);
    }
  }

  #getSelectedPanelId(): string | null {
    const storageKey = this.#getScopedStorageKey();

    return localStorage.getItem(storageKey);
  }
}
