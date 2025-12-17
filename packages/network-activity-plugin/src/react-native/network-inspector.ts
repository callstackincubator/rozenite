import { getHTTPInspector, HTTPInspector, HTTP_EVENTS } from './http/http-inspector';
import { getSSEInspector, SSEInspector, SSE_EVENTS } from './sse/sse-inspector';
import { getWebSocketInspector, WebSocketInspector, WEBSOCKET_EVENTS } from './websocket/websocket-inspector';
import { EventsListener } from './events-listener';
import { NetworkActivityEventMap } from '../shared/client';
import type { InspectorsConfig } from './config';

export class NetworkInspector {
  public readonly http: HTTPInspector;
  public readonly sse: SSEInspector;
  public readonly websocket: WebSocketInspector;
  
  constructor() {
    this.http = getHTTPInspector();
    this.sse = getSSEInspector();
    this.websocket = getWebSocketInspector();
  }

  public setup(eventsListener: EventsListener<NetworkActivityEventMap>) {
    HTTP_EVENTS.forEach(event => {
        this.http.on(event, (data) => {
            eventsListener.send(event, data);
        });
    });

    SSE_EVENTS.forEach(event => {
        this.sse.on(event, (data) => {
             eventsListener.send(data.type, data);
        });
    });

    WEBSOCKET_EVENTS.forEach(event => {
        this.websocket.on(event, (data) => {
             eventsListener.send(data.type, data);
        });
    });
  }

  public enable(config: InspectorsConfig = { http: true, sse: true, websocket: true }) {
      if (config.http) this.http.enable();
      if (config.sse) this.sse.enable();
      if (config.websocket) this.websocket.enable();
  }

  public disable() {
      this.http.disable();
      this.sse.disable();
      this.websocket.disable();
  }

  public dispose() {
      this.http.dispose();
      this.sse.dispose();
      this.websocket.dispose();
  }
}

export const getNetworkInspector = (() => {
    let instance: NetworkInspector | null = null;
    return () => {
        if (!instance) {
            instance = new NetworkInspector();
        }
        return instance;
    };
})();
