import { useEffect } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { TanStackQueryPluginClient } from '../shared/messaging';
import { applyTanStackQueryDevtoolsAction } from './devtools-actions';

export const useHandleDevToolsMessages = (
  queryClient: QueryClient,
  client: TanStackQueryPluginClient | null
) => {
  useEffect(() => {
    if (!client) {
      return;
    }

    const subscription = client.onMessage(
      'devtools-action',
      ({ type, queryHash }) => {
        void applyTanStackQueryDevtoolsAction(queryClient, { type, queryHash })
          .catch((error) => {
            const message =
              error instanceof Error ? error.message : String(error);
            console.warn(
              `[Rozenite, tanstack-query-plugin] Failed to apply devtools action "${type}": ${message}`
            );
          });
      }
    );

    return () => {
      subscription.remove();
    };
  }, [client]);
};
