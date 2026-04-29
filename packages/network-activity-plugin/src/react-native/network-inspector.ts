import {
  getHTTPInspector,
  HTTPInspector,
  HTTP_EVENTS,
} from './http/http-inspector';
import { getSSEInspector, SSEInspector, SSE_EVENTS } from './sse/sse-inspector';
import {
  getWebSocketInspector,
  WebSocketInspector,
  WEBSOCKET_EVENTS,
} from './websocket/websocket-inspector';
import {
  getNitroNetworkInspector,
  NitroNetworkInspector,
  NITRO_NETWORK_EVENTS,
} from './nitro-fetch/nitro-network-inspector';
import { EventsListener } from './events-listener';
import { NetworkActivityEventMap } from '../shared/client';
import type { InspectorsConfig } from './config';
import { getResponseBody as getHTTPResponseBody } from './http/http-utils';

export type NetworkInspector = {
  readonly http: HTTPInspector;
  readonly sse: SSEInspector;
  readonly websocket: WebSocketInspector;
  readonly nitro: NitroNetworkInspector;
  setup: (eventsListener: EventsListener<NetworkActivityEventMap>) => void;
  enable: (config?: InspectorsConfig) => void;
  disable: () => void;
  dispose: () => void;
  getResponseBody: (requestId: string) => Promise<string | null>;
};

const createNetworkInspectorInstance = (): NetworkInspector => {
  const http = getHTTPInspector();
  const sse = getSSEInspector();
  const websocket = getWebSocketInspector();
  const nitro = getNitroNetworkInspector();

  return {
    http,
    sse,
    websocket,
    nitro,

    setup(eventsListener: EventsListener<NetworkActivityEventMap>) {
      HTTP_EVENTS.forEach((event) => {
        http.on(event, (data) => {
          eventsListener.send(event, data);
        });
      });

      SSE_EVENTS.forEach((event) => {
        sse.on(event, (data) => {
          eventsListener.send(data.type, data);
        });
      });

      WEBSOCKET_EVENTS.forEach((event) => {
        websocket.on(event, (data) => {
          eventsListener.send(data.type, data);
        });
      });

      NITRO_NETWORK_EVENTS.forEach((event) => {
        nitro.on(event, (data) => {
          eventsListener.send(event, data);
        });
      });
    },

    enable(
      config: InspectorsConfig = { http: true, sse: true, websocket: true },
    ) {
      if (config.http) http.enable();
      if (config.sse) sse.enable();
      if (config.websocket) websocket.enable();
      if (config.http || config.websocket) nitro.enable();
    },

    disable() {
      http.disable();
      sse.disable();
      websocket.disable();
      nitro.disable();
    },

    dispose() {
      http.dispose();
      sse.dispose();
      websocket.dispose();
      nitro.dispose();
    },

    async getResponseBody(requestId: string) {
      const request = http.getNetworkRequestsRegistry().getEntry(requestId);
      if (request) {
        return getHTTPResponseBody(request);
      }

      return nitro.getResponseBody(requestId);
    },
  };
};

export const getNetworkInspector = (() => {
  let instance: NetworkInspector | null = null;

  return (): NetworkInspector => {
    if (!instance) {
      instance = createNetworkInspectorInstance();
    }

    return instance;
  };
})();
