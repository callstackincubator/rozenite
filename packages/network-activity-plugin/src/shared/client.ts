import { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { WebSocketEventMap } from './websocket-events';
import { SSEEventMap } from './sse-events';
import { HttpEventMap } from './http-events';

export * from './http-events';

export type NetworkActivityClientUISettings = {
  showUrlAsName?: boolean;
};

export type NetworkActivityEventMap = {
  // Control events
  'network-enable': unknown;
  'network-disable': unknown;

  // Client UI settings events
  'get-client-ui-settings': unknown;
  'client-ui-settings': {
    settings?: NetworkActivityClientUISettings;
  };
} & HttpEventMap &
  WebSocketEventMap &
  SSEEventMap;

export type NetworkActivityDevToolsClient =
  RozeniteDevToolsClient<NetworkActivityEventMap>;
