import type { NavigationAction, NavigationState } from '@react-navigation/core';
import type { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';

export type ReactNavigationPluginInitMessage = {
  type: 'init';
};

export type ReactNavigationPluginInitialStateMessage = {
  type: 'initial-state';
  state: NavigationState | undefined;
};

export type ReactNavigationPluginActionMessage = {
  type: 'action';
  action: NavigationAction;
  state: NavigationState | undefined;
  stack: string | undefined;
};

export type ReactNavigationPluginResetRootMessage = {
  type: 'reset-root';
  state: NavigationState | undefined;
};

export type ReactNavigationPluginOpenLinkMessage = {
  type: 'open-link';
  href: string;
};

export type { NavigationAction, NavigationState };

export type ReactNavigationPluginEventMap = {
  init: ReactNavigationPluginInitMessage;
  'reset-root': ReactNavigationPluginResetRootMessage;
  'initial-state': ReactNavigationPluginInitialStateMessage;
  action: ReactNavigationPluginActionMessage;
  'open-link': ReactNavigationPluginOpenLinkMessage;
};

export type ReactNavigationPluginClient =
  RozeniteDevToolsClient<ReactNavigationPluginEventMap>;
