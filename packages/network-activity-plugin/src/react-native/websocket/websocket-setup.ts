import { getWebSocketInspector } from './websocket-inspector';
import { WebSocketEventMap } from '../../shared/websocket-events';
import type { EventsListener } from '../events-listener';
import type { NetworkActivityEventMap } from '../../shared/client';

let websocketInspector: ReturnType<typeof getWebSocketInspector> | null = null;

/**
 * Setup WebSocket inspector to forward events to the provided events listener
 */
export const setupWebSocketInspector = (
  eventsListener: EventsListener<NetworkActivityEventMap>
): void => {
  if (websocketInspector) {
    return; // Already set up
  }

  websocketInspector = getWebSocketInspector();

  // Forward all WebSocket events to the events listener
  const events: (keyof WebSocketEventMap)[] = [
    'websocket-connect',
    'websocket-open',
    'websocket-close',
    'websocket-message-sent',
    'websocket-message-received',
    'websocket-error',
    'websocket-connection-status-changed',
  ];

  events.forEach((eventType) => {
    if (websocketInspector) {
      websocketInspector.on(eventType, (event) => {
        eventsListener.send(event.type, event);
      });
    }
  });
};

/**
 * Get or create the WebSocket inspector instance (does not enable it)
 */
export const getWebSocketInspectorInstance = (
  eventsListener: EventsListener<NetworkActivityEventMap>
) => {
  setupWebSocketInspector(eventsListener);
  
  // At this point, websocketInspector is guaranteed to be non-null
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return websocketInspector!;
};
