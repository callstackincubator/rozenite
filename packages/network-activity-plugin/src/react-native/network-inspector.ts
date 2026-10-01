import { recorder } from './http/recorder';
import { enableXhrHook, disableXhrHook, isXhrHookEnabled } from './http/xhr-hook';
import { enableFetchHook, disableFetchHook, isFetchHookEnabled } from './http/fetch-hook';
import { getSSEInspector, SSEInspector, SSE_EVENTS } from './sse/sse-inspector';
import {
  getWebSocketInspector,
  WebSocketInspector,
  WEBSOCKET_EVENTS,
} from './websocket/websocket-inspector';
import {
  createNitroNetworkInspector,
  NitroNetworkInspector,
  NITRO_NETWORK_EVENTS,
} from './nitro-fetch/nitro-network-inspector';
import { EventsListener } from './events-listener';
import { NetworkActivityEventMap, ResponseBody, HttpEventMap } from '../shared/client';
import type { InspectorsConfig } from './config';

export const HTTP_EVENTS: (keyof HttpEventMap)[] = [
  'request-sent',
  'response-received',
  'request-completed',
  'request-failed',
  'request-progress',
];

export const isHttpEvent = (type: string): type is keyof HttpEventMap =>
  (HTTP_EVENTS as readonly string[]).includes(type);

export type NetworkInspector = {
  readonly sse: SSEInspector;
  readonly websocket: WebSocketInspector;
  readonly nitro: NitroNetworkInspector;
  setup: (eventsListener: EventsListener<NetworkActivityEventMap>) => void;
  enable: (config?: InspectorsConfig) => void;
  disable: () => void;
  dispose: () => void;
  getResponseBody: (requestId: string) => Promise<ResponseBody>;
};

const createNetworkInspectorInstance = (): NetworkInspector => {
  const sse = getSSEInspector();
  const websocket = getWebSocketInspector();
  // nitro HTTP traffic is routed straight into the same recorder as the XHR
  // and fetch adapters below, so it never needs a duplicate subscription
  // here — only nitro's WebSocket events do.
  const nitro = createNitroNetworkInspector(recorder);

  return {
    sse,
    websocket,
    nitro,

    setup(eventsListener) {
      HTTP_EVENTS.forEach((event) => {
        recorder.on(event, (data) => eventsListener.send(event, data));
      });
      SSE_EVENTS.forEach((event) => {
        sse.on(event, (data) => eventsListener.send(data.type, data));
      });
      WEBSOCKET_EVENTS.forEach((event) => {
        websocket.on(event, (data) => eventsListener.send(data.type, data));
      });
      NITRO_NETWORK_EVENTS.forEach((event) => {
        nitro.on(event, (data) => eventsListener.send(event, data));
      });
    },

    enable(config: InspectorsConfig = { http: true, sse: true, websocket: true }) {
      if (config.http) {
        if (!isXhrHookEnabled()) enableXhrHook(recorder);
        if (!isFetchHookEnabled()) enableFetchHook(recorder);
      }
      if (config.sse) sse.enable();
      if (config.websocket) websocket.enable();
      if (config.http || config.websocket) nitro.enable();
    },

    disable() {
      disableXhrHook();
      disableFetchHook();
      sse.disable();
      websocket.disable();
      nitro.disable();
    },

    dispose() {
      disableXhrHook();
      disableFetchHook();
      recorder.clear();
      sse.dispose();
      websocket.dispose();
      nitro.dispose();
    },

    async getResponseBody(requestId: string) {
      return recorder.getResponseBody(requestId);
    },
  };
};

export const getNetworkInspector = ((): (() => NetworkInspector) => {
  let instance: NetworkInspector | null = null;
  return () => (instance ??= createNetworkInspectorInstance());
})();
