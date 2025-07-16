import { RuntimeEvent, SDK, UI } from './rn-devtools-frontend.js';
import { RozenitePluginModel } from './plugin-model.js';
import { JSONValue } from './types.js';

export class PluginView
  extends UI.View.SimpleView
  implements SDK.TargetManager.SDKModelObserver<RozenitePluginModel>
{
  #model: RozenitePluginModel | null = null;
  #src: string;

  constructor(panelId: string, name: string, url: string) {
    super(name + ' 💎', true, panelId);

    this.#src = url;

    SDK.TargetManager.TargetManager.instance().observeModels(
      RozenitePluginModel,
      this
    );

    this.#renderLoader();
  }

  modelAdded(model: RozenitePluginModel): void {
    this.#model = model;

    model.addEventListener(
      'InitializationCompleted',
      this.#handleInitializationCompleted,
      this
    );
    model.addEventListener(
      'InitializationFailed',
      this.#handleInitializationFailed,
      this
    );
    model.addEventListener('Destroyed', this.#handleBackendDestroyed, this);

    if (model.isInitialized()) {
      // Already initialized from another rendered React DevTools panel - render
      // from initialized state
      this.#renderDevToolsView();
    } else {
      // Once initialized, it will emit InitializationCompleted event
      model.ensureInitialized();
    }
  }

  modelRemoved(model: RozenitePluginModel): void {
    model.removeEventListener(
      'InitializationCompleted',
      this.#handleInitializationCompleted,
      this
    );
    model.removeEventListener(
      'InitializationFailed',
      this.#handleInitializationFailed,
      this
    );
    model.removeEventListener('Destroyed', this.#handleBackendDestroyed, this);
  }

  #handleInitializationCompleted(): void {
    this.#renderDevToolsView();
  }

  #handleInitializationFailed({
    data: errorMessage,
  }: RuntimeEvent<string>): void {
    this.#renderErrorView(errorMessage);
  }

  #handleBackendDestroyed(): void {
    this.#renderLoader();
  }

  #renderDevToolsView(): void {
    this.#clearView();

    const model = this.#model;

    if (model === null) {
      throw new Error('Attempted to render panel, but the model was null');
    }

    const iframe = document.createElement('iframe');
    iframe.src = this.#src;
    iframe.style.height = '100%';
    iframe.style.width = '100%';

    window.addEventListener('message', (event) => {
      if (event.source !== iframe.contentWindow) {
        return;
      }

      model.sendMessage(event.data.payload);
    });

    model.onMessage((message: JSONValue) => {
      iframe.contentWindow?.postMessage(message, '*');
    });

    this.contentElement.appendChild(iframe);
  }

  #renderLoader(): void {
    this.#clearView();

    const loaderContainer = document.createElement('div');
    loaderContainer.setAttribute(
      'style',
      'display: flex; flex: 1; justify-content: center; align-items: center'
    );

    const loader = document.createElement('span');
    loader.classList.add('spinner');

    loaderContainer.appendChild(loader);
    this.contentElement.appendChild(loaderContainer);
  }

  #renderErrorView(errorMessage: string): void {
    this.#clearView();

    const errorContainer = document.createElement('div');
    errorContainer.setAttribute(
      'style',
      'display: flex; flex: 1; flex-direction: column; justify-content: center; align-items: center'
    );

    const errorIconView = document.createElement('div');
    errorIconView.setAttribute('style', 'font-size: 3rem');
    errorIconView.innerHTML = '❗';

    const errorMessageParagraph = document.createElement('p');
    errorMessageParagraph.setAttribute('style', 'user-select: all');
    errorMessageParagraph.innerHTML = errorMessage;

    errorContainer.appendChild(errorIconView);
    errorContainer.appendChild(errorMessageParagraph);
    this.contentElement.appendChild(errorContainer);
  }

  #clearView(): void {
    let child = this.contentElement.lastElementChild;
    while (child) {
      this.contentElement.removeChild(child);
      child = this.contentElement.lastElementChild;
    }
  }
}

export const getPluginView = (panelId: string, name: string, url: string) => {
  return new PluginView(panelId, name, url);
};
