import type {
  NavigationAction,
  NavigationContainerRef,
  NavigationState,
  Route,
} from '@react-navigation/core';
import { useRozenitePluginAgentTool, type AgentTool } from '@rozenite/agent-bridge';

export type NavigationActionHistoryEntry = {
  id: number;
  timestamp: number;
  action: NavigationAction;
  state: NavigationState | undefined;
  stack: string | undefined;
};

type ListActionsInput = {
  offset?: number;
  limit?: number;
};

type ResetRootInput = {
  state: NavigationState;
};

type OpenLinkInput = {
  href: string;
};

type NavigateInput = {
  name: string;
  params?: Record<string, unknown>;
  path?: string;
  merge?: boolean;
};

type GoBackInput = {
  count?: number;
};

type DispatchActionInput = {
  action: NavigationAction;
};

type UseReactNavigationAgentToolsConfig<
  TNavigationContainerRef extends NavigationContainerRef<any> = NavigationContainerRef<any>
> = {
  ref: React.RefObject<TNavigationContainerRef | null>;
  getCurrentState: () => NavigationState | undefined;
  getActionHistory: () => NavigationActionHistoryEntry[];
  resetRoot: (state: NavigationState) => void;
  openLink: (href: string) => Promise<void>;
  navigate: (input: NavigateInput) => void;
  goBack: (count: number) => number;
  dispatchAction: (action: NavigationAction) => void;
};

const pluginId = '@rozenite/react-navigation-plugin';

const getRootStateTool: AgentTool = {
  name: 'get-root-state',
  description: 'Get the current React Navigation root state.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const getFocusedRouteTool: AgentTool = {
  name: 'get-focused-route',
  description: 'Get the currently focused route and route path.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const listActionsTool: AgentTool = {
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
};

const resetRootTool: AgentTool = {
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
};

const openLinkTool: AgentTool = {
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
};

const navigateTool: AgentTool = {
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
};

const goBackTool: AgentTool = {
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
};

const dispatchActionTool: AgentTool = {
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
};

const getCurrentRouteDetails = (state: NavigationState | undefined) => {
  if (!state) {
    return {
      routePath: [] as string[],
      focusedRoute: null as null | {
        key: string;
        name: string;
        path?: string;
      },
      navigatorPath: [] as string[],
      params: undefined as unknown,
    };
  }

  const routePath: string[] = [];
  const navigatorPath: string[] = [];
  let currentState: NavigationState | undefined = state;
  let currentRoute: Route<string> | undefined;

  while (currentState) {
    const index = Math.max(0, currentState.index);
    const route = currentState.routes[index];
    if (!route) {
      break;
    }

    routePath.push(route.name);
    navigatorPath.push(currentState.type);
    currentRoute = route as Route<string>;
    currentState = route.state as NavigationState | undefined;
  }

  return {
    routePath,
    focusedRoute: currentRoute
      ? {
          key: currentRoute.key,
          name: currentRoute.name,
          path: currentRoute.path,
        }
      : null,
    navigatorPath,
    params: currentRoute?.params,
  };
};

export const useReactNavigationAgentTools = <
  TNavigationContainerRef extends NavigationContainerRef<any> = NavigationContainerRef<any>
>({
  ref,
  getCurrentState,
  getActionHistory,
  resetRoot,
  openLink,
  navigate,
  goBack,
  dispatchAction,
}: UseReactNavigationAgentToolsConfig<TNavigationContainerRef>) => {
  useRozenitePluginAgentTool({
    pluginId,
    tool: getRootStateTool,
    handler: () => {
      const state = getCurrentState();
      return {
        state,
        hasState: !!state,
      };
    },
  });

  useRozenitePluginAgentTool({
    pluginId,
    tool: getFocusedRouteTool,
    handler: () => {
      return getCurrentRouteDetails(getCurrentState());
    },
  });

  useRozenitePluginAgentTool<ListActionsInput>({
    pluginId,
    tool: listActionsTool,
    handler: ({ offset = 0, limit = 100 }) => {
      const history = getActionHistory();
      const safeOffset = Math.max(0, Math.floor(offset));
      const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));

      return {
        total: history.length,
        offset: safeOffset,
        limit: safeLimit,
        items: history.slice(safeOffset, safeOffset + safeLimit),
      };
    },
  });

  useRozenitePluginAgentTool<ResetRootInput>({
    pluginId,
    tool: resetRootTool,
    handler: ({ state }) => {
      if (!state || typeof state !== 'object') {
        throw new Error('A valid navigation state is required.');
      }

      if (!ref.current) {
        throw new Error('Navigation ref is not ready.');
      }

      resetRoot(state);
      return {
        applied: true,
      };
    },
  });

  useRozenitePluginAgentTool<OpenLinkInput>({
    pluginId,
    tool: openLinkTool,
    handler: async ({ href }) => {
      if (typeof href !== 'string' || href.trim().length === 0) {
        throw new Error('A non-empty href string is required.');
      }

      await openLink(href);
      return {
        opened: true,
        href,
      };
    },
  });

  useRozenitePluginAgentTool<NavigateInput>({
    pluginId,
    tool: navigateTool,
    handler: ({ name, params, path, merge }) => {
      if (typeof name !== 'string' || name.trim().length === 0) {
        throw new Error('A non-empty route name is required.');
      }

      if (
        params !== undefined &&
        (typeof params !== 'object' || params === null || Array.isArray(params))
      ) {
        throw new Error('params must be an object when provided.');
      }

      if (!ref.current) {
        throw new Error('Navigation ref is not ready.');
      }

      navigate({
        name,
        params,
        path,
        merge,
      });

      return {
        applied: true,
        name,
      };
    },
  });

  useRozenitePluginAgentTool<GoBackInput>({
    pluginId,
    tool: goBackTool,
    handler: ({ count = 1 }) => {
      if (!Number.isFinite(count)) {
        throw new Error('count must be a finite number.');
      }

      if (!ref.current) {
        throw new Error('Navigation ref is not ready.');
      }

      const safeCount = Math.max(1, Math.floor(count));
      const performed = goBack(safeCount);
      return {
        applied: performed > 0,
        requested: safeCount,
        performed,
      };
    },
  });

  useRozenitePluginAgentTool<DispatchActionInput>({
    pluginId,
    tool: dispatchActionTool,
    handler: ({ action }) => {
      if (!action || typeof action !== 'object') {
        throw new Error('A valid navigation action object is required.');
      }

      if (typeof action.type !== 'string' || action.type.trim().length === 0) {
        throw new Error('Navigation action must include a non-empty "type".');
      }

      if (!ref.current) {
        throw new Error('Navigation ref is not ready.');
      }

      dispatchAction(action);
      return {
        applied: true,
        type: action.type,
      };
    },
  });
};
