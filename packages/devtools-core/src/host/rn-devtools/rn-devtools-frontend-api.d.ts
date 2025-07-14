declare module '/callstack/ui/legacy/legacy.js' {
  export namespace View {
    export class SimpleView extends Widget.Widget {
      contentElement: HTMLElement;

      constructor(title: string);
      viewId(): string;
      widget(): Promise<Widget.Widget>;
    }
  }

  export namespace Panel {
    export class Panel {
      constructor(name: string, useShadowDom?: boolean);
    }
  }

  export namespace Widget {
    export class Widget {
      readonly element: HTMLElement;
      setDefaultFocusedElement(element: Element | null): void;
      setHideOnDetach(): void;
      wasShown(): void;
      willHide(): void;
      isShowing(): boolean;
    }
  }

  export namespace ViewManager {
    export function registerViewExtension(extension: {
      location: 'panel';
      id: string;
      title: () => string;
      persistence: 'permanent';
      loadView: () => Promise<unknown>;
    }): void;
  }

  export namespace InspectorView {
    export class InspectorView {
      static instance(): InspectorView;
      addPanel(panel: View.SimpleView): void;
      hasPanel(panelName: string): boolean;
    }
  }
}

export {};
