import type { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import {
  DevToolsActionType,
  SerializableQueryClient,
  SerializableQuery,
  SerializableMutation,
  SerializableObserver,
  PartialQueryState,
} from './types';

export type TanStackQueryPluginEventMap = {
  'online-status-changed': {
    online: boolean;
  };
  'devtools-action': {
    type: DevToolsActionType;
    queryHash: string;
    metadata?: {
      data?: unknown;
    };
  };
  /**
   * Announced by the device once it is listening for panel messages. The panel
   * is recreated on every app reload and asks for the cache immediately, which
   * can land before the app's React tree has mounted the plugin; this lets the
   * panel ask again instead of staying empty until the app is restarted.
   */
  'device-ready': unknown;
  'request-initial-data': unknown;
  'sync-data': {
    data: SerializableQueryClient;
  };
  'sync-query-event':
    | {
        type: 'added' | 'removed';
        data: SerializableQuery;
      }
    | {
        type: 'updated';
        action?: string; // Add action type for optimization
        data: SerializableQuery | PartialQueryState; // Support both full and partial state
      }
    | {
        type: 'observerAdded' | 'observerRemoved' | 'observerOptionsUpdated';
        data: {
          queryHash: string;
          observers: SerializableObserver[];
        };
      };
  'sync-mutation-event': {
    type:
      | 'added'
      | 'updated'
      | 'removed'
      | 'observerAdded'
      | 'observerRemoved'
      | 'observerResultsUpdated'
      | 'observerOptionsUpdated';
    data: SerializableMutation;
  };
};

export type TanStackQueryPluginClient = RozeniteDevToolsClient<TanStackQueryPluginEventMap>;
