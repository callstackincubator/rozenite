/**
 * Forked from `packages/web/src/react-native/fuseboxReactDevToolsDispatcher.ts`,
 * itself vendored from React Native's `setUpFuseboxReactDevToolsDispatcher.js`
 * (see that file for the upstream link and history). This version targets
 * Lynx instead of React Native / Hermes:
 *
 * - `Domain.sendMessage` calls `lynx.getDevtool().dispatchEvent(...)` instead
 *   of invoking the CDP binding `global[BINDING_NAME](...)`: Lynx's Runtime
 *   domain has no `Runtime.addBinding`, so that global never gets installed.
 *   `lynx.getDevtool()` is Lynx's own bidirectional devtool channel. The
 *   serialized payload shape stays byte-identical to React Native's —
 *   `JSON.stringify({ domain: this.name, message })` — because the
 *   dev-server bridge re-emits that string verbatim as the `payload` of a
 *   synthesised `Runtime.bindingCalled`, and `@rozenite/app`'s binding
 *   parser expects exactly that shape.
 * - The `Domain` constructor's guard no longer checks for the (nonexistent)
 *   CDP binding; it checks that `lynx.getDevtool` is callable instead.
 * - `global` -> `globalThis`: Lynx's JS engine is PrimJS and has no `global`.
 * - `DomainName` is the single-member union `'rozenite'`, not
 *   `'react-devtools'`.
 *
 * `BINDING_NAME` and the installed global's name
 * (`__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__`) are unchanged and are pure
 * decoration on Lynx — nothing on Lynx ever reads
 * `__CHROME_DEVTOOLS_FRONTEND_BINDING__`. Keeping both names, though, means
 * `@rozenite/app` and `@rozenite/plugin-bridge` need no Lynx-specific branch:
 * they just see the same dispatcher shape they already know how to drive.
 *
 * Traffic direction is one-way, device -> host, via `Domain.sendMessage`
 * below. Host -> device continues to arrive over `Runtime.evaluate`, which
 * Lynx implements for real: the host evaluates
 * `__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__.sendMessage("rozenite", "<json>")`
 * in the app, landing in the static `sendMessage` below and fanning out to
 * `domain.onMessage`. Do NOT add an `addEventListener` call against the
 * devtool proxy for the host -> device direction: `Runtime.evaluate` already
 * delivers it, and listening on the proxy too would double-deliver every
 * host -> device message.
 */

import { getDevtool, isDevtoolAvailable } from './lynx-devtool.js';

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JSONValue }
  | JSONValue[];
export type DomainName = 'rozenite';

export class EventScope<T> {
  private listeners = new Set<(value: T) => void>();

  addEventListener(listener: (value: T) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(listener: (value: T) => void): void {
    this.listeners.delete(listener);
  }

  emit(value: T): void {
    // Assuming that listeners won't throw.
    for (const listener of this.listeners) {
      listener(value);
    }
  }
}

export class Domain {
  name: DomainName;
  onMessage: EventScope<JSONValue>;

  constructor(name: DomainName) {
    if (!isDevtoolAvailable()) {
      throw new Error(
        `Could not create domain ${name}: \`lynx.getDevtool\` is not available. ` +
          'On native Lynx, please upgrade your LynxSDK to the latest version; if you are ' +
          'running outside of a Lynx runtime, `@rozenite/lynx` cannot be used there.',
      );
    }

    this.name = name;
    this.onMessage = new EventScope<JSONValue>();
  }

  sendMessage(message: { event: unknown; payload: unknown }): void {
    const messageWithDomain = { domain: this.name, message };
    const serializedMessageWithDomain = JSON.stringify(messageWithDomain);

    getDevtool().dispatchEvent({
      type: this.name,
      data: serializedMessageWithDomain,
    });
  }
}

/**
 * Globally bound object providing a hook for React DevTools-shaped runtime
 * API calls over Lynx's devtool channel.
 */
export class FuseboxReactDevToolsDispatcher {
  static domainNameToDomainMap = new Map<DomainName, Domain>();

  // Decoration only on Lynx: kept so consumers (`@rozenite/app`,
  // `@rozenite/plugin-bridge`) that were written against the React Native
  // shape don't need a Lynx-specific branch. Nothing on Lynx reads this
  // binding.
  static BINDING_NAME = '__CHROME_DEVTOOLS_FRONTEND_BINDING__';
  static onDomainInitialization = new EventScope<Domain>();

  // Should be private, referenced from the Rozenite host only.
  static initializeDomain(domainName: DomainName): Domain {
    const domain = new Domain(domainName);

    this.domainNameToDomainMap.set(domainName, domain);
    this.onDomainInitialization.emit(domain);

    return domain;
  }

  // Should be private, referenced from the Rozenite host only. This is the
  // host -> device path: the host evaluates a call to this method in the
  // app via CDP's `Runtime.evaluate`.
  static sendMessage(domainName: DomainName, message: string): void {
    const domain = this.domainNameToDomainMap.get(domainName);
    if (domain == null) {
      throw new Error(`Could not send message to ${domainName}: domain doesn't exist`);
    }

    try {
      const parsedMessage = JSON.parse(message);
      domain.onMessage.emit(parsedMessage);
    } catch (err) {
      console.error(`Error while trying to send a message to domain ${domainName}:`, err);
    }
  }
}
