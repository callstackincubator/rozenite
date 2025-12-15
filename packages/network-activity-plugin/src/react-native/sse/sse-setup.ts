import { getSSEInspector } from './sse-inspector';
import { SSEEventMap } from '../../shared/sse-events';
import type { EventsListener } from '../events-listener';
import type { NetworkActivityEventMap } from '../../shared/client';

let sseInspector: ReturnType<typeof getSSEInspector> | null = null;

export type SSEInspectorInstance = ReturnType<typeof getSSEInspector>;

/**
 * Setup SSE inspector to forward events to the provided events listener
 */
export const setupSSEInspector = (
  eventsListener: EventsListener<NetworkActivityEventMap>,
  enable = false
): SSEInspectorInstance => {
  if (sseInspector) {
    return sseInspector;
  }

  sseInspector = getSSEInspector();

  // Forward all SSE events to the events listener
  const events: (keyof SSEEventMap)[] = [
    'sse-open',
    'sse-message',
    'sse-error',
    'sse-close',
  ];

  events.forEach((eventType) => {
    if (sseInspector) {
      sseInspector.on(eventType, (event) => {
        eventsListener.send(event.type, event);
      });
    }
  });

  // Enable inspector if requested
  if (enable && sseInspector) {
    sseInspector.enable();
  }

  return sseInspector;
};