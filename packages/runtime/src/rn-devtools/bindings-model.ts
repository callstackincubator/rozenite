// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// This is a direct equivalent of ReactDevToolsBindingsModel and could be dropped
// if built-in models verify whether it has been enabled before

import { RuntimeEvent, SDK } from './rn-devtools-frontend.js';
import { DomainMessageListener, JSONValue } from './types.js';

const DOMAIN_NAME = 'rozenite';

// Hermes doesn't support Workers API yet, so there is a single execution context at the moment
// This will be used for an extra-check to future-proof this logic
// See https://github.com/facebook/react-native/blob/40b54ee671e593d125630391119b880aebc8393d/packages/react-native/ReactCommon/jsinspector-modern/InstanceTarget.cpp#L61
const MAIN_EXECUTION_CONTEXT_NAME = 'main';
const RUNTIME_GLOBAL = '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__';

export class RozeniteBindingsModel extends SDK.SDKModel.SDKModel {
  private messagingBindingName: string | null = null;
  private enabled = false;
  private fuseboxDispatcherIsInitialized = false;
  private messageQueue: JSONValue[] = [];
  private messageListeners: Set<DomainMessageListener> = new Set();

  override dispose(): void {
    this.messageQueue = [];

    const runtimeModel = this.target().model(SDK.RuntimeModel.RuntimeModel);
    runtimeModel?.removeEventListener(
      'BindingCalled',
      this.bindingCalled,
      this
    );
    runtimeModel?.removeEventListener(
      'ExecutionContextCreated',
      this.onExecutionContextCreated,
      this
    );
    runtimeModel?.removeEventListener(
      'ExecutionContextDestroyed',
      this.onExecutionContextDestroyed,
      this
    );
  }

  private bindingCalled(
    event: RuntimeEvent<{ name: string; payload: string }>
  ): void {
    // If binding name is not initialized, then we failed to get its name
    if (
      this.messagingBindingName === null ||
      event.data.name !== this.messagingBindingName
    ) {
      return;
    }

    const serializedMessage = event.data.payload;
    let parsedMessage = null;

    try {
      parsedMessage = JSON.parse(serializedMessage);
    } catch {
      throw new Error('Failed to parse bindingCalled event payload');
    }

    if (parsedMessage) {
      const domainName = parsedMessage.domain;

      if (parsedMessage.domain !== DOMAIN_NAME) {
        // Ignore messages for other domains
        return;
      }

      if (this.fuseboxDispatcherIsInitialized) {
        // This should never happen.
        // It is expected that messages are flushed out right after we notify listeners with BackendExecutionContextCreated event
        if (!this.isDomainMessagesQueueEmpty()) {
          throw new Error(
            `Attempted to send a message to domain ${domainName} while queue is not empty`
          );
        }

        this.dispatchMessageToDomainEventListeners(parsedMessage.message);
      } else {
        // This could happen when backend is already sending messages via binding
        // But ReactDevToolsBindingsModel is busy executing async tasks
        this.queueMessage(parsedMessage.message);
      }
    }
  }

  private queueMessage(message: JSONValue): void {
    this.messageQueue.push(message);
  }

  private flushOutDomainMessagesQueues(): void {
    for (const message of this.messageQueue) {
      this.dispatchMessageToDomainEventListeners(message);
    }
    this.messageQueue = [];
  }

  private isDomainMessagesQueueEmpty(): boolean {
    return this.messageQueue.length === 0;
  }

  subscribeToDomainMessages(listener: DomainMessageListener): void {
    this.messageListeners.add(listener);
  }

  unsubscribeFromDomainMessages(listener: DomainMessageListener): void {
    const listeners = this.messageListeners;
    listeners.delete(listener);
  }

  private dispatchMessageToDomainEventListeners(message: JSONValue): void {
    const listeners = this.messageListeners;

    const errors = [];
    for (const listener of listeners) {
      try {
        listener(message);
      } catch (e) {
        errors.push(e);
      }
    }

    if (errors.length > 0) {
      throw new Error(
        'Error occurred in RozeniteBindingsModel while calling event listeners'
      );
    }
  }

  async initializeDomain(): Promise<void> {
    const runtimeModel = this.target().model(SDK.RuntimeModel.RuntimeModel);
    if (!runtimeModel) {
      throw new Error(
        `Failed to initialize domain for RozeniteBindingsModel: runtime model is not available`
      );
    }

    await runtimeModel.agent.invoke_evaluate({
      expression: `void ${RUNTIME_GLOBAL}.initializeDomain('${DOMAIN_NAME}')`,
    });
  }

  async sendMessage(message: JSONValue): Promise<void> {
    // If Execution Context is destroyed, do not attempt to send a message (evaluate anything)
    // This could happen when we destroy Bridge from ReactDevToolsModel, which attempts to send `shutdown` event
    // We still need to call `bridge.shutdown()` in order to unsubscribe all listeners on the Frontend (this) side
    if (!this.fuseboxDispatcherIsInitialized) {
      return;
    }

    const runtimeModel = this.target().model(SDK.RuntimeModel.RuntimeModel);
    if (!runtimeModel) {
      throw new Error(
        `Failed to send message from RozeniteBindingsModel: runtime model is not available`
      );
    }

    const serializedMessage = JSON.stringify(message);
    const escapedMessage = JSON.stringify(serializedMessage);

    // Note: Double quote must be used in case we get a string with a nested JSON object.
    await runtimeModel.agent.invoke_evaluate({
      expression: `${RUNTIME_GLOBAL}.sendMessage('${DOMAIN_NAME}', ${escapedMessage})`,
    });
  }

  async enable(): Promise<void> {
    if (this.enabled) {
      throw new Error('RozeniteBindingsModel is already enabled');
    }

    const runtimeModel = this.target().model(SDK.RuntimeModel.RuntimeModel);
    if (!runtimeModel) {
      throw new Error(
        'Failed to enable RozeniteBindingsModel: runtime model is not available'
      );
    }

    await this.waitForFuseboxDispatcherToBeInitialized()
      .then(() =>
        runtimeModel.agent.invoke_evaluate({
          expression: `${RUNTIME_GLOBAL}.BINDING_NAME`,
        })
      )
      .then((response) => {
        if (response.exceptionDetails) {
          throw new Error(
            'Failed to get binding name for RozeniteBindingsModel on a global: ' +
              response.exceptionDetails.text
          );
        }

        if (
          response.result.value === null ||
          response.result.value === undefined
        ) {
          throw new Error(
            'Failed to get binding name for RozeniteBindingsModel on a global: returned value is ' +
              String(response.result.value)
          );
        }

        if (response.result.value === '') {
          throw new Error(
            'Failed to get binding name for ReactDevToolsBindingsModel on a global: returned value is an empty string'
          );
        }

        return response.result.value;
      })
      .then((bindingName) => {
        this.messagingBindingName = bindingName;
        runtimeModel.addEventListener(
          'BindingCalled',
          this.bindingCalled,
          this
        );

        return runtimeModel.agent.invoke_addBinding({ name: bindingName });
      })
      .then((response) => {
        const possiblyError = response.getError();
        if (possiblyError) {
          throw new Error(
            'Failed to add binding for ReactDevToolsBindingsModel: ' +
              possiblyError
          );
        }

        this.enabled = true;
        this.initializeExecutionContextListeners();
      });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private initializeExecutionContextListeners(): void {
    const runtimeModel = this.target().model(SDK.RuntimeModel.RuntimeModel);
    if (!runtimeModel) {
      throw new Error(
        'Failed to initialize execution context listeners for RozeniteBindingsModel: runtime model is not available'
      );
    }

    runtimeModel.addEventListener(
      'ExecutionContextCreated',
      this.onExecutionContextCreated,
      this
    );
    runtimeModel.addEventListener(
      'ExecutionContextDestroyed',
      this.onExecutionContextDestroyed,
      this
    );
  }

  private onExecutionContextCreated({
    data: executionContext,
  }: RuntimeEvent<{ name: string }>): void {
    if (executionContext.name !== MAIN_EXECUTION_CONTEXT_NAME) {
      return;
    }

    void this.waitForFuseboxDispatcherToBeInitialized()
      .then(() => {
        this.dispatchEventToListeners('BackendExecutionContextCreated');
        this.flushOutDomainMessagesQueues();
      })
      .catch((error: Error) =>
        this.dispatchEventToListeners(
          'BackendExecutionContextUnavailable',
          error.message
        )
      );
  }

  private onExecutionContextDestroyed({
    data: executionContext,
  }: RuntimeEvent<{ name: string }>): void {
    if (executionContext.name !== MAIN_EXECUTION_CONTEXT_NAME) {
      return;
    }

    this.fuseboxDispatcherIsInitialized = false;
    this.dispatchEventToListeners('BackendExecutionContextDestroyed');
  }

  private async waitForFuseboxDispatcherToBeInitialized(
    attempt = 1
  ): Promise<void> {
    // Ideally, this should not be polling, but rather one `Runtime.evaluate` request with `awaitPromise` option
    // We need to support it in Hermes first, then we can migrate this to awaitPromise
    if (attempt >= 20) {
      // ~5 seconds
      throw new Error('Failed to wait for initialization: it took too long');
    }

    const runtimeModel = this.target().model(SDK.RuntimeModel.RuntimeModel);
    if (!runtimeModel) {
      throw new Error(
        'Failed to wait for React DevTools dispatcher initialization: runtime model is not available'
      );
    }

    await runtimeModel.agent
      .invoke_evaluate({
        expression: `globalThis.${RUNTIME_GLOBAL} != undefined`,
        returnByValue: true,
      })
      .then((response) => {
        if (response.exceptionDetails) {
          throw new Error(
            'Failed to wait for React DevTools dispatcher initialization: ' +
              response.exceptionDetails.text
          );
        }

        if (response.result.value === false) {
          // Wait for 250 ms and restart
          return new Promise((resolve) => setTimeout(resolve, 250)).then(() =>
            this.waitForFuseboxDispatcherToBeInitialized(attempt + 1)
          );
        }

        this.fuseboxDispatcherIsInitialized = true;
        return;
      });
  }
}

SDK.SDKModel.SDKModel.register(RozeniteBindingsModel, {
  capabilities: 4,
  autostart: false,
});
