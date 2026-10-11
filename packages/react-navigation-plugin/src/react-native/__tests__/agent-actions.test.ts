import { describe, expect, it } from 'vitest';
import type { NavigationState } from '@react-navigation/core';
import { reactNavigationToolDefinitions } from '../../shared/agent-tools';
import type { NavigationActionHistoryEntry } from '../../shared/agent-tools';
import { getActionRouteName, getReactNavigationActionDetails } from '../agent-actions';

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
});
