import { RuntimeEvent, SDK } from './rn-devtools-frontend';
import { RozeniteBindingsModel } from './bindings-model';
import { DomainMessageListener, JSONValue } from './types.js';

export class RozenitePluginModel extends SDK.SDKModel.SDKModel {
  readonly #bindingsModel: RozeniteBindingsModel;
  readonly #listeners = new Set<DomainMessageListener>();
  #initializeCalled = false;
  #initialized = false;

  constructor(target: SDK.Target.Target) {
    super(target);

    const bindingsModel = target.model(RozeniteBindingsModel);
    if (bindingsModel === null) {
      throw new Error(
        `Failed to construct RozenitePluginModel: RozeniteBindingsModel was null`
      );
    }

    this.#bindingsModel = bindingsModel;

    bindingsModel.addEventListener(
      'BackendExecutionContextCreated',
      this.#handleBackendExecutionContextCreated,
      this
    );
    bindingsModel.addEventListener(
      'BackendExecutionContextUnavailable',
      this.#handleBackendExecutionContextUnavailable,
      this
    );
    bindingsModel.addEventListener(
      'BackendExecutionContextDestroyed',
      this.#handleBackendExecutionContextDestroyed,
      this
    );
  }

  override dispose(): void {
    this.#bindingsModel.removeEventListener(
      'BackendExecutionContextCreated',
      this.#handleBackendExecutionContextCreated,
      this
    );
    this.#bindingsModel.removeEventListener(
      'BackendExecutionContextUnavailable',
      this.#handleBackendExecutionContextUnavailable,
      this
    );
    this.#bindingsModel.removeEventListener(
      'BackendExecutionContextDestroyed',
      this.#handleBackendExecutionContextDestroyed,
      this
    );

    this.#listeners.clear();
  }

  ensureInitialized(): void {
    if (this.#initializeCalled) {
      return;
    }

    this.#initializeCalled = true;
    void this.#initialize();
  }

  async #initialize(): Promise<void> {
    try {
      const bindingsModel = this.#bindingsModel;

      if (!bindingsModel.isEnabled()) {
        await bindingsModel.enable();
      }

      bindingsModel.subscribeToDomainMessages((message) =>
        this.#handleMessage(message)
      );

      await bindingsModel.initializeDomain();

      this.#initialized = true;
      this.#finishInitializationAndNotify();
    } catch (e) {
      this.dispatchEventToListeners(
        'InitializationFailed',
        (e as Error).message
      );
    }
  }

  isInitialized(): boolean {
    return this.#initialized;
  }

  #handleMessage(message: JSONValue): void {
    if (!message) {
      return;
    }

    for (const listener of this.#listeners) {
      listener(message);
    }
  }

  async sendMessage(message: JSONValue): Promise<void> {
    const rdtBindingsModel = this.#bindingsModel;
    if (!rdtBindingsModel) {
      throw new Error(
        'RozenitePluginModel failed to send message: RozeniteBindingsModel was null'
      );
    }

    return await rdtBindingsModel.sendMessage(message);
  }

  onMessage(listener: DomainMessageListener): () => void {
    this.#listeners.add(listener);

    return (): void => {
      this.#listeners.delete(listener);
    };
  }

  #handleBackendExecutionContextCreated(): void {
    const rdtBindingsModel = this.#bindingsModel;
    if (!rdtBindingsModel) {
      throw new Error(
        'RozenitePluginModel failed to handle BackendExecutionContextCreated event: RozeniteBindingsModel was null'
      );
    }

    // This could happen if the app was reloaded while RozeniteBindingsModel was initializing
    if (!rdtBindingsModel.isEnabled()) {
      this.ensureInitialized();
    } else {
      this.#finishInitializationAndNotify();
    }
  }

  #finishInitializationAndNotify(): void {
    this.dispatchEventToListeners('InitializationCompleted');
  }

  #handleBackendExecutionContextUnavailable({
    data: errorMessage,
  }: RuntimeEvent<string>): void {
    this.dispatchEventToListeners('InitializationFailed', errorMessage);
  }

  #handleBackendExecutionContextDestroyed(): void {
    this.#listeners.clear();

    this.dispatchEventToListeners('Destroyed');
  }
}

SDK.SDKModel.SDKModel.register(RozenitePluginModel, {
  capabilities: 4,
  autostart: false,
});
