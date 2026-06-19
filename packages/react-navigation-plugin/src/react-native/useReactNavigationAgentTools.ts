import type {
  NavigationAction,
  NavigationContainerRef,
  NavigationState,
  Route,
} from '@react-navigation/core';
import { useRozenitePluginAgentTool } from '@rozenite/agent-bridge';
import {
  REACT_NAVIGATION_AGENT_PLUGIN_ID,
  reactNavigationToolDefinitions,
  type NavigationActionHistoryEntry,
  type ReactNavigationNavigateArgs,
} from '../shared/agent-tools';

export type { NavigationActionHistoryEntry } from '../shared/agent-tools';

type UseReactNavigationAgentToolsConfig<
  TNavigationContainerRef extends NavigationContainerRef<any> = NavigationContainerRef<any>
> = {
  ref: React.RefObject<TNavigationContainerRef | null>;
  getCurrentState: () => NavigationState | undefined;
  getActionHistory: () => NavigationActionHistoryEntry[];
  resetRoot: (state: NavigationState) => void;
  openLink: (href: string) => Promise<void>;
  navigate: (input: ReactNavigationNavigateArgs) => void;
  goBack: (count: number) => number;
  dispatchAction: (action: NavigationAction) => void;
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
    pluginId: REACT_NAVIGATION_AGENT_PLUGIN_ID,
    tool: reactNavigationToolDefinitions.getRootState,
    handler: () => {
      const state = getCurrentState();
      return {
        state,
        hasState: !!state,
      };
    },
  });

  useRozenitePluginAgentTool({
    pluginId: REACT_NAVIGATION_AGENT_PLUGIN_ID,
    tool: reactNavigationToolDefinitions.getFocusedRoute,
    handler: () => {
      return getCurrentRouteDetails(getCurrentState());
    },
  });

  useRozenitePluginAgentTool({
    pluginId: REACT_NAVIGATION_AGENT_PLUGIN_ID,
    tool: reactNavigationToolDefinitions.listActions,
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

  useRozenitePluginAgentTool({
    pluginId: REACT_NAVIGATION_AGENT_PLUGIN_ID,
    tool: reactNavigationToolDefinitions.resetRoot,
    handler: ({ state }) => {
      if (!state || typeof state !== 'object') {
        throw new Error('A valid navigation state is required.');
      }

      if (!ref.current) {
        throw new Error('Navigation ref is not ready.');
      }

      resetRoot(state);
      return {
        applied: true as const,
      };
    },
  });

  useRozenitePluginAgentTool({
    pluginId: REACT_NAVIGATION_AGENT_PLUGIN_ID,
    tool: reactNavigationToolDefinitions.openLink,
    handler: async ({ href }) => {
      if (typeof href !== 'string' || href.trim().length === 0) {
        throw new Error('A non-empty href string is required.');
      }

      await openLink(href);
      return {
        opened: true as const,
        href,
      };
    },
  });

  useRozenitePluginAgentTool({
    pluginId: REACT_NAVIGATION_AGENT_PLUGIN_ID,
    tool: reactNavigationToolDefinitions.navigate,
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
        applied: true as const,
        name,
      };
    },
  });

  useRozenitePluginAgentTool({
    pluginId: REACT_NAVIGATION_AGENT_PLUGIN_ID,
    tool: reactNavigationToolDefinitions.goBack,
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

  useRozenitePluginAgentTool({
    pluginId: REACT_NAVIGATION_AGENT_PLUGIN_ID,
    tool: reactNavigationToolDefinitions.dispatchAction,
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
        applied: true as const,
        type: action.type,
      };
    },
  });
};
