import type { NavigationState } from '@react-navigation/core';
import { describe, expect, it, vi } from 'vitest';
import { resetNavigationRoot, subscribeToExpoRouterActions } from '../expoRouterActions';

const state = { key: 'navigator:root', stale: false } as unknown as NavigationState;

describe('resetNavigationRoot', () => {
  it('dispatches a RESET to the root navigator when resetRoot is missing', () => {
    const navigation = { dispatch: vi.fn(), getRootState: () => ({ key: 'navigator:root' }) };

    resetNavigationRoot(navigation, state);

    expect(navigation.dispatch).toHaveBeenCalledWith({
      type: 'RESET',
      payload: state,
      target: 'navigator:root',
    });
  });

  it('dispatches an untargeted RESET when the root state is not available yet', () => {
    const navigation = { dispatch: vi.fn(), getRootState: () => undefined };

    resetNavigationRoot(navigation, state);

    expect(navigation.dispatch).toHaveBeenCalledWith({
      type: 'RESET',
      payload: state,
      target: undefined,
    });
  });
});

describe('subscribeToExpoRouterActions', () => {
  it('returns undefined instead of throwing when expo-router is not installed', () => {
    expect(subscribeToExpoRouterActions(vi.fn())).toBeUndefined();
  });
});
