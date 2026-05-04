import { defineAgentToolDescriptors } from '@rozenite/agent-shared';
import {
  REACT_NAVIGATION_AGENT_PLUGIN_ID,
  reactNavigationToolDefinitions,
} from './src/shared/agent-tools.js';

export {
  REACT_NAVIGATION_AGENT_PLUGIN_ID,
  reactNavigationToolDefinitions,
};

export const reactNavigationTools = defineAgentToolDescriptors(
  REACT_NAVIGATION_AGENT_PLUGIN_ID,
  reactNavigationToolDefinitions,
);

export type {
  NavigationActionHistoryEntry,
  ReactNavigationDispatchActionArgs,
  ReactNavigationDispatchActionResult,
  ReactNavigationFocusedRoute,
  ReactNavigationGetFocusedRouteArgs,
  ReactNavigationGetFocusedRouteResult,
  ReactNavigationGetRootStateArgs,
  ReactNavigationGetRootStateResult,
  ReactNavigationGoBackArgs,
  ReactNavigationGoBackResult,
  ReactNavigationListActionsArgs,
  ReactNavigationListActionsResult,
  ReactNavigationNavigateArgs,
  ReactNavigationNavigateResult,
  ReactNavigationOpenLinkArgs,
  ReactNavigationOpenLinkResult,
  ReactNavigationResetRootArgs,
  ReactNavigationResetRootResult,
} from './src/shared/agent-tools.js';

export type {
  NavigationAction,
  NavigationState,
} from './src/shared/index.js';
