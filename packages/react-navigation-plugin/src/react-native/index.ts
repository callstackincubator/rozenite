import { useEffect } from 'react';
import { NavigationContainerRef } from '@react-navigation/core';
import {
  useRozeniteDevToolsClient,
  Subscription,
} from '@rozenite/plugin-bridge';
import { useReactNavigationEvents } from './useReactNavigationEvents';
import { ReactNavigationPluginEventMap } from '../shared';
import { Linking } from 'react-native';

export type ReactNavigationDevToolsConfig<
  TNavigationContainerRef extends NavigationContainerRef<any> = NavigationContainerRef<any>
> = {
  ref: React.RefObject<TNavigationContainerRef | null>;
};

export const useReactNavigationDevTools = ({
  ref,
}: ReactNavigationDevToolsConfig): void => {
  const client = useRozeniteDevToolsClient<ReactNavigationPluginEventMap>({
    pluginId: '@rozenite/react-navigation-plugin',
  });

  useReactNavigationEvents(ref, (message) => {
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
        client.send('initial-state', {
          type: 'initial-state',
          state: ref.current?.getRootState(),
        });
      }),
      client.onMessage('reset-root', (message) => {
        ref.current?.resetRoot(message.state);
      }),
      client.onMessage('open-link', (message) => {
        try {
          Linking.openURL(message.href);
        } catch {
          // We don't care about errors here
        }
      })
    );

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [client]);
};
