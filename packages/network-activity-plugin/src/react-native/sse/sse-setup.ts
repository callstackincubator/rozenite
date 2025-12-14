import { getSSEInspector } from './sse-inspector';
import { SSEEventMap } from '../../shared/sse-events';
import type { EventsListener } from '../events-listener';
import type { NetworkActivityEventMap } from '../../shared/client';

let sseInspector: ReturnType<typeof getSSEInspector> | null = null;

/**
 * Setup SSE inspector to forward events to the provided events listener
 */
export const setupSSEInspector = (
  eventsListener: EventsListener<NetworkActivityEventMap>
): void => {
  if (sseInspector) {
    return; // Already set up
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
};

/**
 * Get or create the SSE inspector instance (does not enable it)
 */
export const getSSEInspectorInstance = (
  eventsListener: EventsListener<NetworkActivityEventMap>
) => {
  setupSSEInspector(eventsListener);
  
  // At this point, sseInspector is guaranteed to be non-null
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return sseInspector!;
};
