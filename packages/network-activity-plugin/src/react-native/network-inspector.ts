import { getHTTPInspector, HTTPInspector, HTTP_EVENTS } from './http/http-inspector';
import { getSSEInspector, SSEInspector, SSE_EVENTS } from './sse/sse-inspector';
import { getWebSocketInspector, WebSocketInspector, WEBSOCKET_EVENTS } from './websocket/websocket-inspector';
import { EventsListener } from './events-listener';
import { NetworkActivityEventMap } from '../shared/client';
import type { InspectorsConfig } from './config';

export type NetworkInspector = {
  readonly http: HTTPInspector;
  readonly sse: SSEInspector;
  readonly websocket: WebSocketInspector;
  setup: (eventsListener: EventsListener<NetworkActivityEventMap>) => void;
  enable: (config?: InspectorsConfig) => void;
  disable: () => void;
  dispose: () => void;
};

const createNetworkInspectorInstance = (): NetworkInspector => {
  const http = getHTTPInspector();
  const sse = getSSEInspector();
  const websocket = getWebSocketInspector();

  return {
    http,
    sse,
    websocket,

    setup(eventsListener: EventsListener<NetworkActivityEventMap>) {
      HTTP_EVENTS.forEach(event => {
        http.on(event, (data) => {
          eventsListener.send(event, data);
        });
      });

      SSE_EVENTS.forEach(event => {
        sse.on(event, (data) => {
          eventsListener.send(data.type, data);
        });
      });

      WEBSOCKET_EVENTS.forEach(event => {
        websocket.on(event, (data) => {
          eventsListener.send(data.type, data);
        });
      });
    },

    enable(config: InspectorsConfig = { http: true, sse: true, websocket: true }) {
      if (config.http) http.enable();
      if (config.sse) sse.enable();
      if (config.websocket) websocket.enable();
    },

    disable() {
      http.disable();
      sse.disable();
      websocket.disable();
    },

    dispose() {
      http.dispose();
      sse.dispose();
      websocket.dispose();
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
