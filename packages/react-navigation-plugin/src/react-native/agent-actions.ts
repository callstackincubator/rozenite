import type { NavigationState } from '@react-navigation/core';
import { paginateArray } from '@rozenite/agent-shared';
import type {
  NavigationActionHistoryEntry,
  ReactNavigationActionDetails,
  ReactNavigationActionRow,
  ReactNavigationGetActionDetailsArgs,
  ReactNavigationListActionsArgs,
  ReactNavigationListActionsResult,
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

const toActionRow = (
  entry: NavigationActionHistoryEntry,
  include: ReadonlySet<string>,
): ReactNavigationActionRow => ({
  id: entry.id,
  timestamp: entry.timestamp,
  type: entry.action.type,
  routeName: getActionRouteName(entry),
  action: entry.action,
  ...(include.has('state') ? { state: entry.state } : {}),
  ...(include.has('origin') && entry.origin !== undefined ? { origin: entry.origin } : {}),
});

const getDeprecatedOffset = (offset: unknown): number =>
  typeof offset === 'number' && Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;

/** `history` is newest first, as the plugin records it. */
export const listReactNavigationActions = (
  history: readonly NavigationActionHistoryEntry[],
  { limit, cursor, offset, include }: ReactNavigationListActionsArgs = {},
): ReactNavigationListActionsResult => {
  if (cursor !== undefined && offset !== undefined) {
    throw new Error('Provide either cursor or offset, not both.');
  }

  // `offset` is deprecated: it only picks where the first page starts.
  const start = cursor === undefined ? getDeprecatedOffset(offset) : 0;
  const { items, page } = paginateArray(history.slice(start), {
    keyOf: (entry) => entry.id,
    limit,
    cursor,
  });
  const includeSet = new Set<string>(include ?? []);

  return {
    total: history.length,
    offset:
      items.length > 0
        ? history.indexOf(items[0])
        : page.reset
          ? 0
          : cursor !== undefined
            ? history.length
            : Math.min(start, history.length),
    limit: page.limit,
    items: items.map((entry) => toActionRow(entry, includeSet)),
    page,
  };
};
