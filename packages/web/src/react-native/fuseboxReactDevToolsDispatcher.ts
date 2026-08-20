/**
 * Vendored from React Native's `setUpFuseboxReactDevToolsDispatcher.js`, which
 * is only reachable via the private `react-native/src/private/...` path and
 * is blocked entirely under React Native's Strict TypeScript API
 * (https://reactnative.dev/docs/strict-typescript-api). The module is fully
 * self-contained (no further RN-internal imports), so it's copied here
 * verbatim aside from the Flow -> TypeScript conversion and the idempotency
 * guard noted below.
 *
 * @see https://github.com/facebook/react-native/blob/v0.86.0/packages/react-native/src/private/devsupport/rndevtools/setUpFuseboxReactDevToolsDispatcher.js
 */

import type { FuseboxDomain } from './types.js';

type JSONValue = string | number | boolean | null | { [key: string]: JSONValue } | JSONValue[];
type DomainName = 'react-devtools';

class EventScope<T> {
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

class Domain implements FuseboxDomain {
  name: DomainName;
  onMessage: EventScope<JSONValue>;

  constructor(name: DomainName) {
    if ((global as Record<string, unknown>)[FuseboxReactDevToolsDispatcher.BINDING_NAME] == null) {
      throw new Error(`Could not create domain ${name}: receiving end doesn't exist`);
    }

    this.name = name;
    this.onMessage = new EventScope<JSONValue>();
  }

  sendMessage(message: { event: unknown; payload: unknown }) {
    const messageWithDomain = { domain: this.name, message };
    const serializedMessageWithDomain = JSON.stringify(messageWithDomain);

    (
      (global as Record<string, unknown>)[FuseboxReactDevToolsDispatcher.BINDING_NAME] as (
        message: string,
      ) => void
    )(serializedMessageWithDomain);
  }
}

/**
 * Globally bound object providing a hook for React DevTools runtime API calls
 * over CDP.
 */
class FuseboxReactDevToolsDispatcher {
  static domainNameToDomainMap = new Map<DomainName, Domain>();

  // Referenced and initialized from Chrome DevTools frontend.
  static BINDING_NAME = '__CHROME_DEVTOOLS_FRONTEND_BINDING__';
  static onDomainInitialization = new EventScope<Domain>();

  // Should be private, referenced from Chrome DevTools frontend only.
  static initializeDomain(domainName: DomainName): Domain {
    const domain = new Domain(domainName);

    this.domainNameToDomainMap.set(domainName, domain);
    this.onDomainInitialization.emit(domain);

    return domain;
  }

  // Should be private, referenced from Chrome DevTools frontend only.
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

// Unlike RN's original module-level side effect, guard against redefining
// the global if something else already set it up first, since
// Object.defineProperty below would otherwise throw on a non-configurable
// property.
if ((global as Record<string, unknown>).__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__ == null) {
  Object.defineProperty(global, '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__', {
    value: FuseboxReactDevToolsDispatcher,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}
