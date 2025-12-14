import { getHTTPInspector } from './http-inspector';
import { getOverridesRegistry } from './overrides-registry';
import { setupRequestOverride } from './http-utils';
import { XHRInterceptor } from './xhr-interceptor';
import type { EventsListener } from '../events-listener';
import type { NetworkActivityEventMap } from '../../shared/client';

const overridesRegistry = getOverridesRegistry();
let httpInspector: ReturnType<typeof getHTTPInspector> | null = null;

/**
 * Setup HTTP inspector to forward events to the provided events listener
 */
export const setupHTTPInspector = (
  eventsListener: EventsListener<NetworkActivityEventMap>
): void => {
  if (httpInspector) {
    return; // Already set up
  }

  httpInspector = getHTTPInspector();

  // Set up request override callback
  XHRInterceptor.setOverrideCallback((request) =>
    setupRequestOverride(overridesRegistry, request),
  );

  // Forward all HTTP events to the events listener
  const events: Array<keyof Pick<NetworkActivityEventMap, 'request-sent' | 'response-received' | 'request-completed' | 'request-failed'>> = [
    'request-sent',
    'response-received',
    'request-completed',
    'request-failed',
  ];

  events.forEach((eventType) => {
    if (httpInspector) {
      httpInspector.on(eventType, (event) => {
        eventsListener.send(eventType, event);
      });
    }
  });
};

export type HTTPInspectorInstance = ReturnType<typeof getHTTPInspector>;

/**
 * Get or create the HTTP inspector instance (does not enable it)
 */
export const getHTTPInspectorInstance = (
  eventsListener: EventsListener<NetworkActivityEventMap>
): HTTPInspectorInstance => {
  setupHTTPInspector(eventsListener);
  
  // At this point, httpInspector is guaranteed to be non-null
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return httpInspector!;
};
