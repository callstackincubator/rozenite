import {
  defineAgentToolContract,
  definePaginatedAgentToolContract,
  type AgentToolContract,
  type PageEnvelope,
} from '@rozenite/agent-shared';
import type { NavigationAction, NavigationState } from './index';
import type { ActionOrigin } from '../react-native/symbolication/types';

export const REACT_NAVIGATION_AGENT_PLUGIN_ID = '@rozenite/react-navigation-plugin';

export type NavigationActionHistoryEntry = {
  id: number;
  timestamp: number;
  action: NavigationAction;
  state: NavigationState | undefined;
  /**
   * Captured dispatch context for this navigation action.
   *
   * - `undefined` when React Navigation did not supply a stack.
   * - When defined, contains the raw stack string, parsed frames, the
   *   selected origin frame with a confidence level, and the
   *   symbolication status. Agents querying "where did this come from?"
   *   should read `origin.originFrame` after confirming
   *   `origin.symbolicationStatus === 'complete'`.
   */
  origin?: ActionOrigin;
};

export type ReactNavigationListActionsInclude = 'state' | 'origin';

export type ReactNavigationListActionsArgs = {
  /** Page size. Defaults to 20, max 100. */
  limit?: number;
  /** Opaque cursor from a previous page. */
  cursor?: string;
  /** @deprecated Use `cursor`. Index the first page starts at. */
  offset?: number;
  /** Heavy row fields to add: the state after each action and its dispatch origin. */
  include?: ReactNavigationListActionsInclude[];
};

/**
 * A `list-actions` row. `state` and `origin` are present only when asked
 * for with `include`; `get-action-details` always returns them.
 */
export type ReactNavigationActionRow = {
  id: number;
  timestamp: number;
  type: string;
  /** Target route name from the action payload, else the focused route after it. */
  routeName: string | null;
  action: NavigationAction;
  state?: NavigationState | undefined;
  origin?: ActionOrigin;
};

/**
 * A navigation action as `get-action-details` returns it: the full history
 * entry, plus the action `type` and target `routeName` that `list-actions`
 * rows carry.
 */
export type ReactNavigationActionDetails = NavigationActionHistoryEntry & {
  type: string;
  /** Target route name from the action payload, else the focused route after it. */
  routeName: string | null;
};

export type ReactNavigationGetActionDetailsArgs = {
  id: number;
  /**
   * Accepted for symmetry with `list-actions`: details always carry `state`
   * and `origin`. An unknown value is an error.
   */
  include?: ReactNavigationListActionsInclude[];
};

export type ReactNavigationGetActionDetailsResult = ReactNavigationActionDetails;

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
  /** Index of the first returned action in the newest-first history. */
  offset: number;
  limit: number;
  items: ReactNavigationActionRow[];
  page: PageEnvelope;
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
  listActions: definePaginatedAgentToolContract<
    ReactNavigationListActionsArgs,
    ReactNavigationListActionsResult
  >({
    name: 'list-actions',
    description:
      'List recorded navigation actions, newest first, using cursor pagination. Rows carry id, timestamp, type and target routeName; use include or get-action-details for the state after an action and its dispatch origin.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Pagination size. Defaults to 20, max 100.',
        },
        cursor: {
          type: 'string',
          description:
            'Opaque cursor from a previous list-actions page; the next page starts after the last action returned.',
        },
        offset: {
          type: 'number',
          description:
            '@deprecated Use cursor. Index the first page starts at; cannot be combined with cursor.',
        },
        include: {
          type: 'array',
          items: { type: 'string', enum: ['state', 'origin'] },
          description:
            'Heavy fields to add to each row: "state" (navigation state after the action) and "origin" (captured dispatch stack). Unknown values are rejected.',
        },
      },
    },
    pagination: {
      kind: 'cursor',
      fields: ['id', 'timestamp', 'type', 'routeName', 'action', 'state', 'origin'],
      defaultFields: ['id', 'timestamp', 'type', 'routeName'],
      meta: ['total'],
    },
  }),
  getActionDetails: defineAgentToolContract<
    ReactNavigationGetActionDetailsArgs,
    ReactNavigationGetActionDetailsResult
  >({
    name: 'get-action-details',
    description:
      'Get one recorded navigation action by id, including the navigation state after it and the captured dispatch origin.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Action id from list-actions.',
        },
        include: {
          type: 'array',
          items: { type: 'string', enum: ['state', 'origin'] },
          description:
            'Accepted for symmetry with list-actions; details always include "state" and "origin". Unknown values are rejected.',
        },
      },
      required: ['id'],
    },
  }),
  resetRoot: defineAgentToolContract<ReactNavigationResetRootArgs, ReactNavigationResetRootResult>({
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
  openLink: defineAgentToolContract<ReactNavigationOpenLinkArgs, ReactNavigationOpenLinkResult>({
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
  navigate: defineAgentToolContract<ReactNavigationNavigateArgs, ReactNavigationNavigateResult>({
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
  goBack: defineAgentToolContract<ReactNavigationGoBackArgs, ReactNavigationGoBackResult>({
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
    description: 'Dispatch an arbitrary React Navigation action (e.g. NAVIGATE, JUMP_TO).',
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
