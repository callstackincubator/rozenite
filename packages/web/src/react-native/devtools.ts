/**
 * This is a modified version of the setUpReactDevTools.js from react-native.
 * @see https://github.com/facebook/react-native/blob/v0.86.0/packages/react-native/Libraries/Core/setUpReactDevTools.js
 *
 * Important: do NOT import from 'react-native' directly!
 * For some reason, it'll break the hook and React DevTools won't work.
 *
 * The Fusebox dispatcher setup, style-attribute list, and style flattener
 * below are vendored from react-native's private modules (see the @see
 * links on each) rather than imported, since those paths are blocked under
 * react-native's Strict TypeScript API.
 */

import type { FuseboxDomain } from './types.js';
import { defineRozeniteGlobal } from './rozeniteGlobal.js';
import { loadPersistedHookSettings, savePersistedHookSettings } from './storage/local.js';
import { getReloadAndProfileConfig, setReloadAndProfileConfig } from './storage/session.js';
import { readReloadAndProfileConfig } from './reloadAndProfile.js';
import { createFuseboxConnection } from './fuseboxConnection.js';
import { initialize, connectWithCustomMessagingProtocol } from 'react-devtools-core';
import './fuseboxReactDevToolsDispatcher.js';
import { nativeStyleEditorValidAttributes } from './nativeStyleEditorValidAttributes.js';
import resolveRNStyle from './flattenStyle.js';

declare global {
  var __FUSEBOX_REACT_DEVTOOLS_DISPATCHER__: {
    BINDING_NAME: string;
    initializeDomain: (domainName: string) => FuseboxDomain;
    onDomainInitialization: {
      addEventListener: (listener: (domain: FuseboxDomain) => void) => void;
      removeEventListener: (listener: (domain: FuseboxDomain) => void) => void;
    };
  };
}

// 1. Global config
defineRozeniteGlobal();

// 2. Session store
const sessionStore = {
  getReloadAndProfileConfig,
  setReloadAndProfileConfig,
};

// 3. Initialize hook
const hookSettings = loadPersistedHookSettings();
const { isProfiling, profilingSettings } = readReloadAndProfileConfig(sessionStore);
initialize(hookSettings, isProfiling, profilingSettings);

// 4. Set up Fusebox connection
const fuseboxDispatcher = global.__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__;
const bindingName = fuseboxDispatcher.BINDING_NAME;

const { connect, disconnectIfNeeded } = createFuseboxConnection({
  sessionStore,
  nativeStyleEditorValidAttributes,
  resolveRNStyle,
  connectWithCustomMessagingProtocol,
  savePersistedHookSettings,
  readReloadAndProfileConfig,
});

export const connectToReactDevTools = () => {
  // 5. Connect if already initialized
  if (global[bindingName as keyof typeof global] != null) {
    disconnectIfNeeded();
    connect(fuseboxDispatcher.initializeDomain('react-devtools'));
  }

  // 6. Listen for future initializations
  fuseboxDispatcher.onDomainInitialization.addEventListener((domain) => {
    if (domain.name === 'react-devtools') {
      disconnectIfNeeded();
      connect(domain);
    }
  });
};
