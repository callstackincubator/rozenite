import type { NavigationState } from '@react-navigation/core';
import type {
  NavigationActionHistoryEntry,
  ReactNavigationActionDetails,
  ReactNavigationGetActionDetailsArgs,
} from '../shared/agent-tools';

const getFocusedRouteName = (state: NavigationState | undefined): string | null => {
  let current: NavigationState | undefined = state;
  let name: string | null = null;

  while (current) {
    const route = current.routes[Math.max(0, current.index)];
    if (!route) {
      break;
    }
    name = route.name;
    current = route.state as NavigationState | undefined;
  }

  return name;
};

/**
 * The route an action navigated to: `payload.name` for NAVIGATE, PUSH,
 * JUMP_TO and friends, otherwise the route focused in the state after it
 * (GO_BACK, POP, RESET).
 */
export const getActionRouteName = (entry: NavigationActionHistoryEntry): string | null => {
  const payload = (entry.action as { payload?: unknown }).payload;
  if (payload && typeof payload === 'object') {
    const name = (payload as { name?: unknown }).name;
    if (typeof name === 'string') {
      return name;
    }
  }

  return getFocusedRouteName(entry.state);
};

export const getReactNavigationActionDetails = (
  history: readonly NavigationActionHistoryEntry[],
  { id }: ReactNavigationGetActionDetailsArgs,
): ReactNavigationActionDetails => {
  const entry = history.find((candidate) => candidate.id === id);
  if (!entry) {
    const available = history.map((candidate) => candidate.id).join(', ');
    throw new Error(`Unknown action id "${id}". Available: ${available || '(none)'}`);
  }

  return {
    ...entry,
    type: entry.action.type,
    routeName: getActionRouteName(entry),
  };
};
