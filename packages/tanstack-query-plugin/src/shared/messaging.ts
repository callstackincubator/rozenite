import type { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { DevToolsActionType, SerializableQueryClient } from './types';

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
};

export type TanStackQueryPluginClient =
  RozeniteDevToolsClient<TanStackQueryPluginEventMap>;
