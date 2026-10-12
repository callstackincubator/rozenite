// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// This is a direct equivalent of ReactDevToolsBindingsModel and could be dropped
// if built-in models verify whether it has been enabled before

import { IS_WEB_TARGET_EXPRESSION } from '@rozenite/tools/integration';
import {
  BOOTSTRAP_DEBOUNCE_MS,
  HandshakeCancelledError,
  RozeniteMissingError,
  MAIN_EXECUTION_CONTEXT_NAME,
  ROZENITE_DOMAIN,
  buildSendMessageExpression,
  runDispatcherHandshake,
  type HandshakeErrorMessages,
  type HandshakeTransport,
} from '@rozenite/tools/protocol';
import { RuntimeEvent, SDK } from './rn-devtools-frontend.js';
import { DomainMessageListener, JSONValue } from './types.js';

export class RozeniteBindingsModel extends SDK.SDKModel.SDKModel {
  private messagingBindingName: string | null = null;
  private enabled = false;
  private fuseboxDispatcherIsInitialized = false;
  private messageQueue: JSONValue[] = [];
  private messageListeners: Set<DomainMessageListener> = new Set();
  private targetIsWeb: boolean | null = null;
  private disposed = false;
  // Bumped every time a handshake is (re)scheduled or the model is disposed;
  // a handshake whose generation is no longer current stops at its next step.
  private handshakeGeneration = 0;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;
  private bindingListenerAttached = false;

  /**
   * Whether the connected target is a browser, as reported by the device
   * itself — `null` until the probe has answered, or if it failed.
   *
   * Half of the target's integration. The other half is the host, which is
   * always `react-native` on this path: the Fusebox-embedded shell is only
   * ever served by a React Native dev server (a Lynx one never registers
   * `/rn_fusebox.html`), so unlike the standalone app there is nothing to
   * fetch. `null` means "unknown", never "not web" — a wrong answer here
   * would be indistinguishable from a right one.
   */
  getTargetIsWeb(): boolean | null {
    return this.targetIsWeb;
  }

  /**
   * Asks the device whether it is a browser by evaluating
   * `IS_WEB_TARGET_EXPRESSION` in its own runtime.
   *
   * The device is the only party that knows for certain, and one Rozenite
   * controls — so it is asked, rather than inferred from React Native's
   * `ReactNativeApplication.metadataUpdated`, an event we neither emit nor
   * can order against anything a host does.
   *
   * Never throws: this is advisory metadata, and `enable()` must not fail
   * (taking every Rozenite panel with it) because one extra evaluate did.
   */
  private async probeTargetIsWeb(): Promise<void> {
    const runtimeModel = this.target().model(SDK.RuntimeModel.RuntimeModel);
    if (!runtimeModel) {
      return;
    }

    try {
      const response = await runtimeModel.agent.invoke_evaluate({
        expression: IS_WEB_TARGET_EXPRESSION,
        returnByValue: true,
      });

      if (response.exceptionDetails) {
        throw new Error(response.exceptionDetails.text);
      }

      if (typeof response.result.value !== 'boolean') {
        throw new Error(`Expected a boolean, got ${typeof response.result.value}.`);
      }

      this.targetIsWeb = response.result.value;
    } catch (error) {
      console.warn('[rozenite] Could not determine whether the target is a browser.', error);
    }
  }

  override dispose(): void {
    this.disposed = true;
    this.handshakeGeneration++;
    if (this.reloadTimer !== null) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }
    this.messageQueue = [];

    const runtimeModel = this.target().model(SDK.RuntimeModel.RuntimeModel);
    runtimeModel?.removeEventListener('BindingCalled', this.bindingCalled, this);
    runtimeModel?.removeEventListener(
      'ExecutionContextCreated',
      this.onExecutionContextCreated,
      this,
    );
    runtimeModel?.removeEventListener(
      'ExecutionContextDestroyed',
      this.onExecutionContextDestroyed,
      this,
    );
  }

  private bindingCalled(event: RuntimeEvent<{ name: string; payload: string }>): void {
    // Deliberately keeps its own throwing parse below instead of `parseBindingPayload`
    // (behaviour preservation, ADR 0003 decision 5).
    // If binding name is not initialized, then we failed to get its name
    if (this.messagingBindingName === null || event.data.name !== this.messagingBindingName) {
      return;
    }

    const serializedMessage = event.data.payload;

    // Rozenite piggybacks React Native's Fusebox dispatcher and shares the single
    // `__CHROME_DEVTOOLS_FRONTEND_BINDING__` binding with React Native's own React
    // DevTools integration. Because the binding name is shared, the `name` check above
    // does not filter out React DevTools traffic, so this handler also receives every
    // React DevTools bridge message (which can carry full component trees and be very
    // large). Those messages are for the `react-devtools` domain, not ours, and would
    // otherwise be JSON.parse'd here only to be discarded a few lines down once we see
    // `parsedMessage.domain !== ROZENITE_DOMAIN`.
    //
    // As a cheap pre-parse fast path, bail out without parsing if the raw string cannot
    // possibly contain our domain marker. This is intentionally a conservative substring
    // search, not a prefix/structure check: it must never rely on where `"rozenite"`
    // appears in the payload (e.g. key ordering of `{domain, message}`), only on whether
    // it appears at all. A message that happens to contain the substring elsewhere still
    // falls through to the real parse + domain check below, which is authoritative -- so
    // a false positive here is harmless. A false negative would require the payload to be
    // serialized with the domain's ASCII letters escaped as JSON unicode escape sequences
    // (i.e. spelling the domain name out as a run of `\uXXXX` codepoint escapes instead of
    // the plain letters), which `JSON.stringify` -- used on the React Native side to build
    // this payload -- never does. So in practice a message with domain "rozenite" always
    // contains that literal substring in the raw payload.
    if (!serializedMessage.includes(ROZENITE_DOMAIN)) {
      return;
    }

    let parsedMessage = null;

    try {
      parsedMessage = JSON.parse(serializedMessage);
    } catch {
      throw new Error('Failed to parse bindingCalled event payload');
    }

    if (parsedMessage) {
      const domainName = parsedMessage.domain;

      if (parsedMessage.domain !== ROZENITE_DOMAIN) {
        // Ignore messages for other domains
        return;
      }

      if (this.fuseboxDispatcherIsInitialized) {
        // This should never happen.
        // It is expected that messages are flushed out right after we notify listeners with BackendExecutionContextCreated event
        if (!this.isDomainMessagesQueueEmpty()) {
          throw new Error(
            `Attempted to send a message to domain ${domainName} while queue is not empty`,
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
      throw new Error('Error occurred in RozeniteBindingsModel while calling event listeners');
    }
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
        `Failed to send message from RozeniteBindingsModel: runtime model is not available`,
      );
    }

    const response = await runtimeModel.agent.invoke_evaluate({
      expression: buildSendMessageExpression(ROZENITE_DOMAIN, message),
    });

    // The generated `invoke_*` methods never reject, so a `.catch()` would be
    // dead code: a JS-level failure while evaluating reaches us here. Before
    // it was dropped on the floor, so a message the device never received
    // looked exactly like a message the device received. This host's only
    // caller is the plugin-iframe relay in `plugin-view.ts`, which does not
    // await, so this reports rather than throws: a rejected promise there
    // would surface as an `unhandledrejection` in the DevTools page itself.
    if (response.exceptionDetails) {
      console.error(
        `[rozenite] Failed to send a message to the ${ROZENITE_DOMAIN} domain: ` +
          response.exceptionDetails.text,
      );
    }
  }

  async enable(): Promise<void> {
    if (this.enabled) {
      throw new Error('RozeniteBindingsModel is already enabled');
    }

    if (!this.target().model(SDK.RuntimeModel.RuntimeModel)) {
      throw new Error('Failed to enable RozeniteBindingsModel: runtime model is not available');
    }

    const generation = ++this.handshakeGeneration;
    try {
      await this.runHandshake(generation);
    } catch (error) {
      if (error instanceof HandshakeCancelledError) {
        throw new Error('RozeniteBindingsModel was disposed while it was being enabled');
      }
      throw error;
    }

    // The handshake can resolve right as the model is disposed.
    if (this.isStale(generation)) {
      throw new Error('RozeniteBindingsModel was disposed while it was being enabled');
    }

    this.enabled = true;
    this.initializeExecutionContextListeners();
    this.fuseboxDispatcherIsInitialized = true;
    this.flushOutDomainMessagesQueues();
  }

  /**
   * The dispatcher handshake (wait for the dispatcher, read the binding name,
   * add the binding, initialize the `rozenite` domain) over the frontend SDK.
   * Shared with the other hosts through `runDispatcherHandshake`.
   *
   * Messages that arrive while it runs are queued, because
   * `fuseboxDispatcherIsInitialized` is only set once it has finished.
   */
  private isStale(generation: number): boolean {
    return this.disposed || generation !== this.handshakeGeneration;
  }

  private runHandshake(generation: number): Promise<void> {
    const isCancelled = (): boolean => this.isStale(generation);

    const runtimeModel = this.target().model(SDK.RuntimeModel.RuntimeModel);
    if (!runtimeModel) {
      return Promise.reject(
        new Error(
          'Failed to wait for React DevTools dispatcher initialization: runtime model is not available',
        ),
      );
    }

    const transport: HandshakeTransport = {
      evaluate: (expression, returnByValue) =>
        runtimeModel.agent.invoke_evaluate({
          expression,
          ...(returnByValue ? { returnByValue } : {}),
        }),
      addBinding: async (name) => {
        this.messagingBindingName = name;
        if (!this.bindingListenerAttached) {
          this.bindingListenerAttached = true;
          runtimeModel.addEventListener('BindingCalled', this.bindingCalled, this);
        }

        const response = await runtimeModel.agent.invoke_addBinding({ name });
        const possiblyError = response.getError();
        if (possiblyError) {
          throw new Error('Failed to add binding for RozeniteBindingsModel: ' + possiblyError);
        }
      },
    };

    return runDispatcherHandshake(transport, {
      domains: [ROZENITE_DOMAIN],
      errors: handshakeErrors,
      isCancelled,
      // After the dispatcher wait only because that is what establishes a
      // live execution context to evaluate in; the expression itself reads
      // plain globals and depends on nothing Rozenite installs. Not repeated
      // after a reload: the answer cannot have changed, and a probe that
      // failed still gets another attempt.
      afterDispatcherReady: async () => {
        if (this.targetIsWeb === null) {
          await this.probeTargetIsWeb();
        }
      },
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private initializeExecutionContextListeners(): void {
    const runtimeModel = this.target().model(SDK.RuntimeModel.RuntimeModel);
    if (!runtimeModel) {
      throw new Error(
        'Failed to initialize execution context listeners for RozeniteBindingsModel: runtime model is not available',
      );
    }

    runtimeModel.addEventListener('ExecutionContextCreated', this.onExecutionContextCreated, this);
    runtimeModel.addEventListener(
      'ExecutionContextDestroyed',
      this.onExecutionContextDestroyed,
      this,
    );
  }

  private onExecutionContextCreated({
    data: executionContext,
  }: RuntimeEvent<{ name: string }>): void {
    if (executionContext.name !== MAIN_EXECUTION_CONTEXT_NAME) {
      return;
    }

    // A new `main` context is a reloaded app: its dispatcher is brand new, so
    // the handshake runs again, like in the app and the agent session. The
    // debounce coalesces the burst of contexts a reload can produce, and the
    // generation cancels a run a newer context has made stale.
    const generation = ++this.handshakeGeneration;
    if (this.reloadTimer !== null) {
      clearTimeout(this.reloadTimer);
    }
    this.reloadTimer = setTimeout(() => {
      this.reloadTimer = null;
      void this.rehandshake(generation);
    }, BOOTSTRAP_DEBOUNCE_MS);
  }

  private async rehandshake(generation: number): Promise<void> {
    try {
      await this.runHandshake(generation);
    } catch (error) {
      if (error instanceof HandshakeCancelledError || this.isStale(generation)) {
        return;
      }
      // The shared "Rozenite is not installed" wording would be wrong here:
      // it was installed a moment ago, the reload is just slow.
      this.dispatchEventToListeners(
        'BackendExecutionContextUnavailable',
        error instanceof RozeniteMissingError
          ? 'The app did not finish reloading in time. Reload the app or reopen React Native DevTools.'
          : (error as Error).message,
      );
      return;
    }

    // The handshake can resolve right as a newer context arrives or the model
    // is disposed; the newer run (or nobody) owns the notification then.
    if (this.isStale(generation)) {
      return;
    }

    this.fuseboxDispatcherIsInitialized = true;
    this.dispatchEventToListeners('BackendExecutionContextCreated');
    this.flushOutDomainMessagesQueues();
  }

  private onExecutionContextDestroyed({
    data: executionContext,
  }: RuntimeEvent<{ name: string }>): void {
    if (executionContext.name !== MAIN_EXECUTION_CONTEXT_NAME) {
      return;
    }

    // Whatever handshake was scheduled or running belongs to the context that
    // just went away.
    this.handshakeGeneration++;
    if (this.reloadTimer !== null) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }

    this.fuseboxDispatcherIsInitialized = false;
    this.dispatchEventToListeners('BackendExecutionContextDestroyed');
  }
}

const handshakeErrors: HandshakeErrorMessages = {
  dispatcherWaitFailed: ({ text }) =>
    new Error('Failed to wait for React DevTools dispatcher initialization: ' + text),
  bindingNameFailed: ({ text }) =>
    new Error('Failed to get binding name for RozeniteBindingsModel on a global: ' + text),
  invalidBindingName: (value) =>
    new Error(
      value === ''
        ? 'Failed to get binding name for RozeniteBindingsModel on a global: returned value is an empty string'
        : 'Failed to get binding name for RozeniteBindingsModel on a global: returned value is ' +
            String(value),
    ),
};

SDK.SDKModel.SDKModel.register(RozeniteBindingsModel, {
  capabilities: 4,
  autostart: false,
});
