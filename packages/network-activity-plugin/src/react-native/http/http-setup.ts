import { getHTTPInspector } from './http-inspector';
import { getOverridesRegistry } from './overrides-registry';
import { setupRequestOverride } from './http-utils';
import { XHRInterceptor } from './xhr-interceptor';
import type { EventsListener } from '../events-listener';
import type { NetworkActivityEventMap } from '../../shared/client';

const overridesRegistry = getOverridesRegistry();
let httpInspector: ReturnType<typeof getHTTPInspector> | null = null;
export type HTTPInspectorInstance = ReturnType<typeof getHTTPInspector>;

/**
 * Setup HTTP inspector to forward events to the provided events listener
 */
export const setupHTTPInspector = (
  eventsListener: EventsListener<NetworkActivityEventMap>,
  enable = false
): HTTPInspectorInstance => {
  if (httpInspector) {
    return httpInspector; // Already set up
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

  // Enable inspector if requested
  if (enable && httpInspector) {
    httpInspector.enable();
  }

  return httpInspector;
};


