import type { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import {
  DevToolsActionType,
  SerializableQueryClient,
  SerializableQuery,
  SerializableMutation,
  SerializableObserver,
} from './types';

export type TanStackQueryPluginEventMap = {
  'online-status-changed': {
    online: boolean;
  };
  'devtools-action': {
    type: DevToolsActionType;
    queryHash: string;
  };
  'request-initial-data': unknown;
  'sync-data': {
    data: SerializableQueryClient;
  };
  'sync-query-event':
    | {
        type: 'added' | 'updated' | 'removed';
        data: SerializableQuery;
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

export type TanStackQueryPluginClient =
  RozeniteDevToolsClient<TanStackQueryPluginEventMap>;
