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

// Matches a `\uXXXX` escape sequence for either half of a surrogate pair
// (D800-DFFF), capturing a *pair* of such escapes (high immediately followed
// by low) before falling back to matching a single one.
const SURROGATE_ESCAPE_SEQUENCE =
  /\\u[dD][89a-fA-F][0-9a-fA-F]{2}\\u[dD][c-fC-F][0-9a-fA-F]{2}|\\u[dD][89a-fA-F][0-9a-fA-F]{2}/g;

// Replaces an unpaired UTF-16 surrogate half with U+FFFD.
//
// Verified against a real device: modern `JSON.stringify` (ES2019+
// "well-formed" `JSON.stringify`) never emits a lone surrogate as a raw code
// unit -- it always escapes it to a literal six-character `\uXXXX` sequence,
// so a real lone surrogate in `message` is already gone as a raw code unit by
// the time `JSON.stringify(message)` returns. The device's own JSON parser is
// stricter than the JSON grammar and rejects that escape sequence outright
// (`"json parse error ... expected another unicode escape for second half of
// surrogate pair"`), which the frontend cannot correlate back to the request
// that caused it -- the error response comes back with `"id": null"`. This
// function operates on the *already-stringified* text, replacing an unpaired
// `\uXXXX` escape sequence (not a raw code unit -- there won't be one).
//
// A raw surrogate *pair* (e.g. ordinary emoji) is not affected by any of
// this: `JSON.stringify` does not escape it at all, so it survives as two
// ordinary UTF-16 code units in the string and this function never matches
// it. U+2028/U+2029 are likewise untouched (not surrogates, and
// `JSON.stringify` does not escape them either).
export const sanitizeUnpairedSurrogates = (jsonText: string): string => {
  let mutated = false;

  const sanitized = jsonText.replace(SURROGATE_ESCAPE_SEQUENCE, (match) => {
    if (match.length === 12) {
      // A high escape immediately followed by a low escape -- a valid pair.
      return match;
    }

    mutated = true;
    return '\uFFFD';
  });

  return mutated ? sanitized : jsonText;
};

export class RozeniteBindingsModel extends SDK.SDKModel.SDKModel {
  private messagingBindingName: string | null = null;
  private enabled = false;
  private fuseboxDispatcherIsInitialized = false;
  private messageQueue: JSONValue[] = [];
  private messageListeners: Set<DomainMessageListener> = new Set();
  private mainExecutionContextId: number | null = null;

  override dispose(): void {
    this.messageQueue = [];
    this.mainExecutionContextId = null;

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
    // If binding name is not initialized, then we failed to get its name
    if (this.messagingBindingName === null || event.data.name !== this.messagingBindingName) {
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

  async initializeDomain(): Promise<void> {
    const runtimeModel = this.target().model(SDK.RuntimeModel.RuntimeModel);
    if (!runtimeModel) {
      throw new Error(
        `Failed to initialize domain for RozeniteBindingsModel: runtime model is not available`,
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
        `Failed to send message from RozeniteBindingsModel: runtime model is not available`,
      );
    }

    // `Runtime.evaluate` requires interpolating the payload into a JS source string
    // that Hermes has to recompile. A single stringify + string-literal interpolation
    // is not reversible for arbitrary strings (e.g. it silently drops messages
    // containing astral-plane characters, since Hermes' source parser can't accept a
    // lone UTF-16 surrogate half in source text). `Runtime.callFunctionOn` with a
    // by-value argument instead ships the string through CDP's own (correct) value
    // serialization, so it round-trips byte-for-byte -- see the emoji round-trip
    // check in this package's send-path tests.
    const serializedMessage = sanitizeUnpairedSurrogates(JSON.stringify(message));
    const functionDeclaration = `function(m) { ${RUNTIME_GLOBAL}.sendMessage(${JSON.stringify(
      DOMAIN_NAME,
    )}, m) }`;

    const executionContextId = this.mainExecutionContextId;

    // We deliberately do not await the round trip: CDP requests are ordered and
    // execute in order on the runtime's JS thread, so message ordering is preserved
    // without blocking the caller on the response. We still inspect the response so
    // a failed send is reported instead of silently dropped, which is the whole
    // reason this path stopped using `Runtime.evaluate` in the first place.
    //
    // `invoke_*` methods on this agent never reject -- a protocol-level failure
    // (e.g. a stale execution context id after a reload) resolves with `getError()`
    // set rather than throwing, so that has to be checked explicitly alongside
    // `exceptionDetails` (a JS-level exception during the evaluated function, a
    // different failure mode -- both are checked below).
    const reportFailure = (response: {
      exceptionDetails?: { text: string };
      getError: () => string | undefined;
    }): void => {
      const protocolError = response.getError();
      if (protocolError) {
        console.error('Failed to send message from RozeniteBindingsModel: ' + protocolError);
        return;
      }
      if (response.exceptionDetails) {
        console.error(
          'Failed to send message from RozeniteBindingsModel: ' + response.exceptionDetails.text,
        );
      }
    };

    if (executionContextId === null) {
      // No main execution context id captured yet (e.g. sent before the first
      // `ExecutionContextCreated` event arrived, or before `enable()`'s initial
      // lookup ran). Fall back to `Runtime.evaluate` rather than dropping the
      // message outright -- this is a rare startup race, not the steady-state path,
      // and the fallback is no worse than this path's previous behavior.
      const escapedMessage = JSON.stringify(serializedMessage);
      void runtimeModel.agent
        .invoke_evaluate({
          expression: `${RUNTIME_GLOBAL}.sendMessage(${JSON.stringify(DOMAIN_NAME)}, ${escapedMessage})`,
        })
        .then((response) => {
          if (response.exceptionDetails) {
            console.error(
              'Failed to send message from RozeniteBindingsModel: ' +
                response.exceptionDetails.text,
            );
          }
        });
      return;
    }

    void runtimeModel.agent
      .invoke_callFunctionOn({
        executionContextId,
        functionDeclaration,
        arguments: [{ value: serializedMessage }],
      })
      .then(reportFailure);
  }

  async enable(): Promise<void> {
    if (this.enabled) {
      throw new Error('RozeniteBindingsModel is already enabled');
    }

    const runtimeModel = this.target().model(SDK.RuntimeModel.RuntimeModel);
    if (!runtimeModel) {
      throw new Error('Failed to enable RozeniteBindingsModel: runtime model is not available');
    }

    await this.waitForFuseboxDispatcherToBeInitialized()
      .then(() =>
        runtimeModel.agent.invoke_evaluate({
          expression: `${RUNTIME_GLOBAL}.BINDING_NAME`,
        }),
      )
      .then((response) => {
        if (response.exceptionDetails) {
          throw new Error(
            'Failed to get binding name for RozeniteBindingsModel on a global: ' +
              response.exceptionDetails.text,
          );
        }

        if (response.result.value === null || response.result.value === undefined) {
          throw new Error(
            'Failed to get binding name for RozeniteBindingsModel on a global: returned value is ' +
              String(response.result.value),
          );
        }

        if (response.result.value === '') {
          throw new Error(
            'Failed to get binding name for ReactDevToolsBindingsModel on a global: returned value is an empty string',
          );
        }

        return response.result.value;
      })
      .then((bindingName) => {
        this.messagingBindingName = bindingName;
        runtimeModel.addEventListener('BindingCalled', this.bindingCalled, this);

        return runtimeModel.agent.invoke_addBinding({ name: bindingName });
      })
      .then((response) => {
        const possiblyError = response.getError();
        if (possiblyError) {
          throw new Error('Failed to add binding for ReactDevToolsBindingsModel: ' + possiblyError);
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
        'Failed to initialize execution context listeners for RozeniteBindingsModel: runtime model is not available',
      );
    }

    runtimeModel.addEventListener('ExecutionContextCreated', this.onExecutionContextCreated, this);
    runtimeModel.addEventListener(
      'ExecutionContextDestroyed',
      this.onExecutionContextDestroyed,
      this,
    );

    // These listeners can be attached after the main execution context already
    // exists (e.g. the app was already running when the DevTools panel opened),
    // in which case its `ExecutionContextCreated` event was dispatched before we
    // were listening and we'd never see it. Resolve it directly from the model's
    // current state so `sendMessage` has a valid execution context id right away,
    // not only after the first reload.
    const existingMainContext = runtimeModel
      .executionContexts()
      .find((context) => context.name === MAIN_EXECUTION_CONTEXT_NAME);
    if (existingMainContext) {
      this.mainExecutionContextId = existingMainContext.id;
    }
  }

  private onExecutionContextCreated({
    data: executionContext,
  }: RuntimeEvent<{ name: string; id: number }>): void {
    if (executionContext.name !== MAIN_EXECUTION_CONTEXT_NAME) {
      return;
    }

    this.mainExecutionContextId = executionContext.id;

    void this.waitForFuseboxDispatcherToBeInitialized()
      .then(() => {
        this.dispatchEventToListeners('BackendExecutionContextCreated');
        this.flushOutDomainMessagesQueues();
      })
      .catch((error: Error) =>
        this.dispatchEventToListeners('BackendExecutionContextUnavailable', error.message),
      );
  }

  private onExecutionContextDestroyed({
    data: executionContext,
  }: RuntimeEvent<{ name: string; id: number }>): void {
    if (executionContext.name !== MAIN_EXECUTION_CONTEXT_NAME) {
      return;
    }

    if (this.mainExecutionContextId === executionContext.id) {
      this.mainExecutionContextId = null;
    }

    this.fuseboxDispatcherIsInitialized = false;
    this.dispatchEventToListeners('BackendExecutionContextDestroyed');
  }

  private async waitForFuseboxDispatcherToBeInitialized(attempt = 1): Promise<void> {
    // Ideally, this should not be polling, but rather one `Runtime.evaluate` request with `awaitPromise` option
    // We need to support it in Hermes first, then we can migrate this to awaitPromise
    if (attempt >= 20) {
      // ~5 seconds
      throw new Error('Failed to wait for initialization: it took too long');
    }

    const runtimeModel = this.target().model(SDK.RuntimeModel.RuntimeModel);
    if (!runtimeModel) {
      throw new Error(
        'Failed to wait for React DevTools dispatcher initialization: runtime model is not available',
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
              response.exceptionDetails.text,
          );
        }

        if (response.result.value === false) {
          // Wait for 250 ms and restart
          return new Promise((resolve) => setTimeout(resolve, 250)).then(() =>
            this.waitForFuseboxDispatcherToBeInitialized(attempt + 1),
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
