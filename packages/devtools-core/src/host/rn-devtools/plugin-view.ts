import { UI } from './rn-devtools-frontend.js';
import { PluginInstance } from '../types.js';
import { getRpcForClient } from '../guest-rpc.js';

class ExtensionServerPanelView extends UI.View.SimpleView {
  private readonly name: string;
  private readonly panel: UI.Panel.Panel;

  constructor(name: string, title: string, panel: UI.Panel.Panel) {
    super(title);
    this.name = name;
    this.panel = panel;
  }

  override viewId(): string {
    return this.name;
  }

  override widget(): Promise<UI.Widget.Widget> {
    return Promise.resolve(this.panel) as Promise<UI.Widget.Widget>;
  }
}

export class ExtensionView extends UI.Widget.Widget {
  private iframe: HTMLIFrameElement;

  constructor(plugin: PluginInstance, src: string, className: string) {
    super();
    this.setHideOnDetach();
    this.element.className = 'vbox flex-auto'; // Override

    // TODO(crbug.com/872438): remove once we can use this.iframe instead
    this.element.tabIndex = -1;

    this.iframe = document.createElement('iframe');
    this.iframe.className = className;
    this.iframe.src = src;

    getRpcForClient(plugin, this.iframe);

    // TODO(crbug.com/872438): make this.iframe the default focused element
    this.setDefaultFocusedElement(this.element);

    this.element.appendChild(this.iframe);
  }
}

export const getPluginView = (
  plugin: PluginInstance,
  viewId: string,
  title: string,
  page: string
) => {
  return new ExtensionServerPanelView(
    viewId,
    title,
    new ExtensionView(plugin, page, 'extension')
  );
};
