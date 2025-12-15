import { getWebSocketInspector } from './websocket-inspector';
import { WebSocketEventMap } from '../../shared/websocket-events';
import type { EventsListener } from '../events-listener';
import type { NetworkActivityEventMap } from '../../shared/client';

let websocketInspector: ReturnType<typeof getWebSocketInspector> | null = null;

export type WebSocketInspectorInstance = ReturnType<typeof getWebSocketInspector>;

/**
 * Setup WebSocket inspector to forward events to the provided events listener
 */
export const setupWebSocketInspector = (
  eventsListener: EventsListener<NetworkActivityEventMap>,
  enable = false
): WebSocketInspectorInstance => {
  if (websocketInspector) {
    return websocketInspector; // Already set up
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

  // Enable inspector if requested
  if (enable && websocketInspector) {
    websocketInspector.enable();
  }

  return websocketInspector;
};