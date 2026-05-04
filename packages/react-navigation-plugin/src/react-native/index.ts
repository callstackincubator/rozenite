import type { NavigationAction, NavigationState } from '@react-navigation/core';
import { CommonActions, NavigationContainerRef } from '@react-navigation/core';
import { useCallback, useEffect, useRef } from 'react';
import {
  useRozeniteDevToolsClient,
  Subscription,
} from '@rozenite/plugin-bridge';
import { useReactNavigationEvents } from './useReactNavigationEvents';
import { ReactNavigationPluginEventMap } from '../shared';
import { Linking } from 'react-native';
import type {
  NavigationActionHistoryEntry,
  ReactNavigationNavigateArgs,
} from '../shared/agent-tools';
import {
  useReactNavigationAgentTools,
} from './useReactNavigationAgentTools';

export type ReactNavigationDevToolsConfig<
  TNavigationContainerRef extends NavigationContainerRef<any> = NavigationContainerRef<any>
> = {
  ref: React.RefObject<TNavigationContainerRef | null>;
};

export const useReactNavigationDevTools = ({
  ref,
}: ReactNavigationDevToolsConfig): void => {
  const actionHistoryRef = useRef<NavigationActionHistoryEntry[]>([]);
  const nextActionIdRef = useRef(1);
  const currentStateRef = useRef<NavigationState | undefined>(undefined);

  const getCurrentState = useCallback(() => {
    return ref.current?.getRootState() ?? currentStateRef.current;
  }, [ref]);

  const getActionHistory = useCallback(() => {
    return actionHistoryRef.current;
  }, []);

  const resetRoot = useCallback(
    (state: NavigationState) => {
      if (!ref.current) {
        throw new Error('Navigation ref is not ready.');
      }

      ref.current.resetRoot(state);
    },
    [ref]
  );

  const openLink = useCallback(async (href: string) => {
    await Linking.openURL(href);
  }, []);

  const navigate = useCallback(
    ({
      name,
      params,
      path,
      merge,
    }: ReactNavigationNavigateArgs) => {
      if (!ref.current) {
        throw new Error('Navigation ref is not ready.');
      }

      ref.current.dispatch(
        CommonActions.navigate({
          name,
          params,
          path,
          merge,
        })
      );
    },
    [ref]
  );

  const goBack = useCallback(
    (count: number) => {
      if (!ref.current) {
        throw new Error('Navigation ref is not ready.');
      }

      let performed = 0;
      for (let i = 0; i < count; i += 1) {
        if (!ref.current.canGoBack()) {
          break;
        }

        ref.current.dispatch(CommonActions.goBack());
        performed += 1;
      }

      return performed;
    },
    [ref]
  );

  const dispatchAction = useCallback(
    (action: NavigationAction) => {
      if (!ref.current) {
        throw new Error('Navigation ref is not ready.');
      }

      ref.current.dispatch(action);
    },
    [ref]
  );

  useReactNavigationAgentTools({
    ref,
    getCurrentState,
    getActionHistory,
    resetRoot,
    openLink,
    navigate,
    goBack,
    dispatchAction,
  });

  const client = useRozeniteDevToolsClient<ReactNavigationPluginEventMap>({
    pluginId: '@rozenite/react-navigation-plugin',
  });

  useReactNavigationEvents(ref, (message) => {
    if (message.type === 'action') {
      currentStateRef.current = message.state;
      const entry: NavigationActionHistoryEntry = {
        id: nextActionIdRef.current,
        timestamp: Date.now(),
        action: message.action,
        state: message.state,
        stack: message.stack,
      };
      nextActionIdRef.current += 1;
      actionHistoryRef.current = [entry, ...actionHistoryRef.current].slice(
        0,
        100
      );
    }

    if (!client) {
      return;
    }

    client.send(message.type, message);
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const subscriptions: Subscription[] = [];

    subscriptions.push(
      client.onMessage('init', () => {
        const initialState = ref.current?.getRootState();
        currentStateRef.current = initialState;
        client.send('initial-state', {
          type: 'initial-state',
          state: initialState,
        });
      }),
      client.onMessage('reset-root', (message) => {
        if (!message.state) {
          return;
        }

        try {
          resetRoot(message.state);
        } catch {
          // We don't care about errors here
        }
      }),
      client.onMessage('open-link', (message) => {
        void openLink(message.href).catch(() => {
          // We don't care about errors here
        });
      })
    );

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [client, openLink, ref, resetRoot]);
};
