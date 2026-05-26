import type { NavigationAction, NavigationState } from '@react-navigation/core';
import type { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import type { ActionOrigin } from '../react-native/symbolication/types';

export type ReactNavigationPluginInitMessage = {
  type: 'init';
};

export type ReactNavigationPluginInitialStateMessage = {
  type: 'initial-state';
  state: NavigationState | undefined;
};

export type ReactNavigationPluginActionMessage = {
  type: 'action';
  id: number;
  action: NavigationAction;
  state: NavigationState | undefined;
  origin?: ActionOrigin;
};

export type ReactNavigationPluginActionSymbolicatedMessage = {
  type: 'action-symbolicated';
  id: number;
  origin: ActionOrigin;
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
  'action-symbolicated': ReactNavigationPluginActionSymbolicatedMessage;
  'open-link': ReactNavigationPluginOpenLinkMessage;
};

export type ReactNavigationPluginClient =
  RozeniteDevToolsClient<ReactNavigationPluginEventMap>;
