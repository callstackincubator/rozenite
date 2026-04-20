import {
  defineAgentToolContract,
  type AgentToolContract,
} from '@rozenite/agent-shared';
import type { NavigationAction, NavigationState } from './index';

export const REACT_NAVIGATION_AGENT_PLUGIN_ID =
  '@rozenite/react-navigation-plugin';

export type NavigationActionHistoryEntry = {
  id: number;
  timestamp: number;
  action: NavigationAction;
  state: NavigationState | undefined;
  stack: string | undefined;
};

export type ReactNavigationListActionsArgs = {
  offset?: number;
  limit?: number;
};

export type ReactNavigationResetRootArgs = {
  state: NavigationState;
};

export type ReactNavigationOpenLinkArgs = {
  href: string;
};

export type ReactNavigationNavigateArgs = {
  name: string;
  params?: Record<string, unknown>;
  path?: string;
  merge?: boolean;
};

export type ReactNavigationGoBackArgs = {
  count?: number;
};

export type ReactNavigationDispatchActionArgs = {
  action: NavigationAction;
};

export type ReactNavigationGetRootStateArgs = undefined;

export type ReactNavigationGetRootStateResult = {
  state: NavigationState | undefined;
  hasState: boolean;
};

export type ReactNavigationFocusedRoute = {
  key: string;
  name: string;
  path?: string;
};

export type ReactNavigationGetFocusedRouteArgs = undefined;

export type ReactNavigationGetFocusedRouteResult = {
  routePath: string[];
  focusedRoute: ReactNavigationFocusedRoute | null;
  navigatorPath: string[];
  params: unknown;
};

export type ReactNavigationListActionsResult = {
  total: number;
  offset: number;
  limit: number;
  items: NavigationActionHistoryEntry[];
};

export type ReactNavigationResetRootResult = {
  applied: true;
};

export type ReactNavigationOpenLinkResult = {
  opened: true;
  href: string;
};

export type ReactNavigationNavigateResult = {
  applied: true;
  name: string;
};

export type ReactNavigationGoBackResult = {
  applied: boolean;
  requested: number;
  performed: number;
};

export type ReactNavigationDispatchActionResult = {
  applied: true;
  type: string;
};

export const reactNavigationToolDefinitions = {
  getRootState: defineAgentToolContract<
    ReactNavigationGetRootStateArgs,
    ReactNavigationGetRootStateResult
  >({
    name: 'get-root-state',
    description: 'Get the current React Navigation root state.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  }),
  getFocusedRoute: defineAgentToolContract<
    ReactNavigationGetFocusedRouteArgs,
    ReactNavigationGetFocusedRouteResult
  >({
    name: 'get-focused-route',
    description: 'Get the currently focused route and route path.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  }),
  listActions: defineAgentToolContract<
    ReactNavigationListActionsArgs,
    ReactNavigationListActionsResult
  >({
    name: 'list-actions',
    description: 'List recorded navigation actions with states using pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        offset: {
          type: 'number',
          description: 'Pagination offset. Defaults to 0.',
        },
        limit: {
          type: 'number',
          description: 'Pagination size. Defaults to 100. Maximum 100.',
        },
      },
    },
  }),
  resetRoot: defineAgentToolContract<
    ReactNavigationResetRootArgs,
    ReactNavigationResetRootResult
  >({
    name: 'reset-root',
    description: 'Reset navigation root state to provided state snapshot.',
    inputSchema: {
      type: 'object',
      properties: {
        state: {
          type: 'object',
          description: 'Navigation state to reset to.',
        },
      },
      required: ['state'],
    },
  }),
  openLink: defineAgentToolContract<
    ReactNavigationOpenLinkArgs,
    ReactNavigationOpenLinkResult
  >({
    name: 'open-link',
    description: 'Open a deep link URL using React Native Linking.',
    inputSchema: {
      type: 'object',
      properties: {
        href: {
          type: 'string',
          description: 'Deep link URL to open.',
        },
      },
      required: ['href'],
    },
  }),
  navigate: defineAgentToolContract<
    ReactNavigationNavigateArgs,
    ReactNavigationNavigateResult
  >({
    name: 'navigate',
    description: 'Navigate to a route by name with optional params.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Target route name.',
        },
        params: {
          description: 'Optional route params.',
        },
        path: {
          type: 'string',
          description: 'Optional path for deep-link style navigation.',
        },
        merge: {
          type: 'boolean',
          description: 'Whether to merge params on existing route.',
        },
      },
      required: ['name'],
    },
  }),
  goBack: defineAgentToolContract<
    ReactNavigationGoBackArgs,
    ReactNavigationGoBackResult
  >({
    name: 'go-back',
    description: 'Go back in navigation history.',
    inputSchema: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: 'How many steps to go back. Defaults to 1.',
        },
      },
    },
  }),
  dispatchAction: defineAgentToolContract<
    ReactNavigationDispatchActionArgs,
    ReactNavigationDispatchActionResult
  >({
    name: 'dispatch-action',
    description:
      'Dispatch an arbitrary React Navigation action (e.g. NAVIGATE, JUMP_TO).',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'object',
          description: 'React Navigation action object to dispatch.',
        },
      },
      required: ['action'],
    },
  }),
} as const satisfies Record<string, AgentToolContract<unknown, unknown>>;
