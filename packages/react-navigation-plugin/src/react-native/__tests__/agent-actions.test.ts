import { describe, expect, it } from 'vitest';
import type { NavigationState } from '@react-navigation/core';
import { reactNavigationToolDefinitions } from '../../shared/agent-tools';
import type { NavigationActionHistoryEntry } from '../../shared/agent-tools';
import {
  getActionRouteName,
  getReactNavigationActionDetails,
  listReactNavigationActions,
} from '../agent-actions';

const stateFocusedOn = (name: string): NavigationState =>
  ({
    key: 'root',
    index: 0,
    routeNames: ['Tabs'],
    type: 'stack',
    stale: false,
    routes: [
      {
        key: 'tabs',
        name: 'Tabs',
        state: {
          key: 'tabs-state',
          index: 0,
          routeNames: [name],
          type: 'tab',
          stale: false,
          routes: [{ key: `${name}-key`, name }],
        },
      },
    ],
  }) as unknown as NavigationState;

const history: NavigationActionHistoryEntry[] = [
  {
    id: 2,
    timestamp: 200,
    action: { type: 'GO_BACK' },
    state: stateFocusedOn('Home'),
  },
  {
    id: 1,
    timestamp: 100,
    action: { type: 'NAVIGATE', payload: { name: 'Details', params: { id: 1 } } },
    state: stateFocusedOn('Details'),
    origin: {
      rawStack: 'at onPress (App.tsx:1:1)',
      frames: [],
      originFrame: null,
      confidence: 'none',
      symbolicationStatus: 'unavailable',
    } as unknown as NavigationActionHistoryEntry['origin'],
  },
];

describe('react navigation action details', () => {
  it('registers get-action-details with a required id', () => {
    expect(reactNavigationToolDefinitions.getActionDetails).toMatchObject({
      name: 'get-action-details',
      inputSchema: { required: ['id'] },
    });
  });

  it('derives the route name from the payload, else from the focused route after the action', () => {
    expect(getActionRouteName(history[1])).toBe('Details');
    expect(getActionRouteName(history[0])).toBe('Home');
    expect(
      getActionRouteName({ id: 3, timestamp: 0, action: { type: 'RESET' }, state: undefined }),
    ).toBe(null);
  });

  it('returns the full history entry with state and origin', () => {
    expect(getReactNavigationActionDetails(history, { id: 1 })).toEqual({
      ...history[1],
      type: 'NAVIGATE',
      routeName: 'Details',
    });
    expect(() => getReactNavigationActionDetails(history, { id: 9 })).toThrow(
      'Unknown action id "9". Available: 2, 1',
    );
  });

  it('lists short rows by default and adds state and origin only on request', () => {
    const result = listReactNavigationActions(history);
    expect(result).toEqual({
      total: 2,
      offset: 0,
      limit: 20,
      items: [
        { id: 2, timestamp: 200, type: 'GO_BACK', routeName: 'Home', action: { type: 'GO_BACK' } },
        {
          id: 1,
          timestamp: 100,
          type: 'NAVIGATE',
          routeName: 'Details',
          action: history[1].action,
        },
      ],
      page: { limit: 20, hasMore: false },
    });

    const withHeavyFields = listReactNavigationActions(history, { include: ['state', 'origin'] });
    expect(withHeavyFields.items[1]).toMatchObject({
      state: history[1].state,
      origin: history[1].origin,
    });
    expect(reactNavigationToolDefinitions.listActions.pagination).toMatchObject({
      defaultFields: ['id', 'timestamp', 'type', 'routeName'],
      meta: ['total'],
    });
  });

  it('continues after the last id and resets when that action fell out of the history', () => {
    const live = [...history];
    const first = listReactNavigationActions(live, { limit: 1 });
    expect(first.items.map((item) => item.id)).toEqual([2]);

    live.unshift({ id: 3, timestamp: 300, action: { type: 'GO_BACK' }, state: undefined });
    const second = listReactNavigationActions(live, { limit: 1, cursor: first.page.nextCursor });
    expect(second).toMatchObject({ offset: 2, items: [{ id: 1 }], page: { hasMore: false } });

    const restart = listReactNavigationActions(live, { limit: 1 });
    live.shift();
    expect(listReactNavigationActions(live, { cursor: restart.page.nextCursor })).toMatchObject({
      items: [],
      page: { reset: true },
    });
  });

  it('still starts at a deprecated offset', () => {
    expect(listReactNavigationActions(history, { offset: 1 })).toMatchObject({
      offset: 1,
      items: [{ id: 1 }],
    });
  });
});
