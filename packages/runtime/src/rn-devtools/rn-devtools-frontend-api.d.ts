/* eslint-disable @typescript-eslint/no-explicit-any */

declare module '/rozenite/ui/legacy/legacy.js' {
  export interface TabbedPaneTab {
    id: string;
  }

  export interface TabbedPaneEventData {
    prevTabId?: string;
    tabId: string;
  }

  export interface TabbedPaneEventTypes {
    TabInvoked: TabbedPaneEventData;
    TabSelected: TabbedPaneEventData;
    TabClosed: TabbedPaneEventData;
    TabOrderChanged: TabbedPaneEventData;
  }

  export interface TabbedPane {
    tabsById: Map<string, TabbedPaneTab>;
    insertBefore(tab: TabbedPaneTab, before: number): void;
    selectTab(tabId: string): void;
    hasTab(tabId: string): boolean;
    addEventListener<T extends keyof TabbedPaneEventTypes>(
      event: T,
      listener: (
        data: Common.EventTarget.EventTargetEvent<TabbedPaneEventTypes[T]>
      ) => void
    ): void;
    removeEventListener(
      event: keyof TabbedPaneEventTypes,
      listener: (data: any) => void
    ): void;
  }

  export namespace View {
    export class SimpleView extends Widget.Widget {
      contentElement: HTMLElement;

      constructor(title: string, useShadowDom?: boolean, viewId?: string);
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
      tabbedPane: TabbedPane;
    }
  }
}

declare module '/rozenite/models/react_native/react_native.js' {
  export namespace RuntimeModel {
    export type ProtocolResponseWithError = {
      /** Returns an error message if the request failed. */
      getError(): string | undefined;
    };

    export type EvaluateResponse = {
      result: {
        type:
          | 'object'
          | 'function'
          | 'undefined'
          | 'string'
          | 'number'
          | 'boolean'
          | 'symbol'
          | 'accessor'
          | 'bigint';
        subtype?:
          | 'array'
          | 'null'
          | 'node'
          | 'regexp'
          | 'date'
          | 'map'
          | 'set'
          | 'weakmap'
          | 'weakset'
          | 'iterator'
          | 'generator'
          | 'error'
          | 'proxy'
          | 'promise'
          | 'typedarray'
          | 'arraybuffer'
          | 'dataview'
          | 'webassemblymemory'
          | 'wasmvalue';
        className?: string;
        value?: any;
        unserializableValue?: string;
        description?: string;
        objectId?: string;
        preview?: {
          type: string;
          subtype?: string;
          description?: string;
          overflow: boolean;
          properties: Array<{
            name: string;
            type: string;
            value?: string;
            valuePreview?: any;
            subtype?: string;
          }>;
          entries?: Array<any>;
        };
        customPreview?: {
          header: string;
          bodyGetterId: string;
          formatterObjectId?: string;
          hasBody?: boolean;
        };
      };
      exceptionDetails?: {
        exceptionId: number;
        text: string;
        lineNumber: number;
        columnNumber: number;
        scriptId?: string;
        url?: string;
        stackTrace?: {
          callFrames: Array<{
            functionName: string;
            scriptId: string;
            url: string;
            lineNumber: number;
            columnNumber: number;
          }>;
          parent?: any;
          promiseCreationFrame?: any;
          asyncStackTrace?: any;
          description?: string;
        };
        exception?: {
          type:
            | 'object'
            | 'function'
            | 'undefined'
            | 'string'
            | 'number'
            | 'boolean'
            | 'symbol'
            | 'accessor'
            | 'bigint';
          subtype?: string;
          className?: string;
          value?: any;
          unserializableValue?: string;
          description?: string;
          objectId?: string;
          preview?: any;
          customPreview?: any;
        };
        executionContextId?: number;
        exceptionMetaData?: any;
      };
    };

    export class RuntimeModel extends SDKModel.SDKModel {
      addEventListener<T>(
        event: string,
        callback: (message: RuntimeEvent<T>) => void,
        thisArg: unknown
      ): void;
      removeEventListener<T>(
        event: string,
        callback: (message: RuntimeEvent<T>) => void,
        thisArg: unknown
      ): void;
      agent: {
        invoke_evaluate: (params: {
          expression: string;
          returnByValue?: boolean;
        }) => Promise<RuntimeModel.EvaluateResponse>;
        invoke_addBinding: (params: {
          name: string;
        }) => Promise<RuntimeModel.ProtocolResponseWithError>;
      };
    }
  }

  export namespace ReactNativeApplicationModel {
    export interface EventTypes {
      MetadataUpdated: Protocol.ReactNativeApplication.MetadataUpdatedEvent;
    }

    export class ReactNativeApplicationModel extends SDKModel.SDKModel {
      ensureEnabled(): void;
      metadataCached?: MetadataUpdatedEvent;
      addEventListener<T extends keyof EventTypes>(
        event: T,
        callback: (
          event: Common.EventTarget.EventTargetEvent<EventTypes[T]>
        ) => void,
        thisArg: unknown
      ): void;
      removeEventListener(
        event: keyof EventTypes,
        callback: (event: any) => void,
        thisArg: unknown
      ): void;
    }
  }

  export namespace ReactDevToolsBindingsModel {
    export class ReactDevToolsBindingsModel {
      initializeDomain(domain: string): Promise<void>;
      subscribeToDomainMessages(
        domain: string,
        callback: (message: unknown) => void
      ): void;
      sendMessage(domain: string, message: unknown): Promise<void>;
      unsubscribeFromDomainMessages(
        domain: string,
        callback: (message: unknown) => void
      ): void;
      addEventListener(
        event: string,
        callback: (message: unknown) => void,
        thisArg: unknown
      ): void;
      removeEventListener(
        event: string,
        callback: (message: unknown) => void,
        thisArg: unknown
      ): void;
      enable(): Promise<void>;
      isEnabled(): boolean;
    }
  }
}

declare module '/rozenite/core/sdk/sdk.js' {
  export namespace SDKModel {
    export class SDKModel<T = unknown> {
      static register(
        model: typeof SDKModel<T>,
        options: {
          capabilities: Target.Capability;
          autostart: boolean;
        }
      ): void;
      constructor(target: Target.Target);
      dispose(): void;
      dispatchEventToListeners(event: string, ...args: unknown[]): void;
      target(): Target.Target;
      addEventListener<T>(
        event: string,
        callback: (message: RuntimeEvent<T>) => void,
        thisArg: unknown
      ): void;
      removeEventListener<T>(
        event: string,
        callback: (message: RuntimeEvent<T>) => void,
        thisArg: unknown
      ): void;
    }
  }

  export namespace Target {
    export class Target {
      model<T>(model: T): InstanceType<T> | null;
    }
  }

  export namespace TargetManager {
    export interface SDKModelObserver<T> {
      modelAdded(model: T): void;
      modelRemoved(model: T): void;
    }

    export class TargetManager {
      static instance(): TargetManager;
      observeModels<T>(
        model: typeof SDKModel.SDKModel<T>,
        observer: SDKModelObserver<T>
      ): void;
      primaryPageTarget(): {
        model<T>(model: typeof SDKModel.SDKModel<T>): T | null;
      };
    }
  }

  namespace Common {
    namespace EventTarget {
      interface EventTargetEvent<T> {
        data: T;
      }
    }
  }

  namespace Protocol {
    namespace ReactNativeApplication {
      interface MetadataUpdatedEvent {
        appDisplayName?: string;
        appIdentifier?: string;
        deviceName?: string;
        platform?: string;
        reactNativeVersion?: string;
        integrationName: string;
        unstable_isProfilingBuild?: boolean;
        unstable_networkInspectionEnabled?: boolean;
      }
    }
  }
}

export {};
