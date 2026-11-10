import { CommonActions, type NavigationState } from '@react-navigation/core';

// Structural so it also accepts the React Navigation fork bundled with Expo Router.
export type NavigationContainerRefLike = {
  getRootState(): any;
  resetRoot?(state?: any): void;
  dispatch(action: any): void;
  canGoBack(): boolean;
  addListener(type: any, callback: (event: any) => void): () => void;
};

export const resetNavigationRoot = (
  navigation: Pick<NavigationContainerRefLike, 'getRootState' | 'resetRoot' | 'dispatch'>,
  state: NavigationState,
): void => {
  if (navigation.resetRoot) {
    navigation.resetRoot(state);
    return;
  }

  // Expo Router 58+ has no `resetRoot`. Without a target the focused navigator would get it first.
  navigation.dispatch({ ...CommonActions.reset(state), target: navigation.getRootState()?.key });
};

// Expo Router 58+ bundles a React Navigation fork without `__unsafe_action__`. This internal
// emitter is the only source of full actions, so any failure to reach it must stay non-fatal.
export const subscribeToExpoRouterActions = (
  listener: (event: { actionType: string; payload?: object }) => void,
): (() => void) | undefined => {
  try {
    const { internalNavigationEvents } =
      require('expo-router/build/global-state/internalNavigationEvents') as {
        internalNavigationEvents: {
          addListener(name: 'actionDispatched', callback: typeof listener): () => void;
        };
      };

    return internalNavigationEvents.addListener('actionDispatched', listener);
  } catch {
    return undefined;
  }
};
