import { NetworkActivityEventMap } from '../shared/client';
import { createEventsListener, EventsListenerOptions } from './events-listener';
import { setupHTTPInspector } from './http/http-setup';
import { setupWebSocketInspector } from './websocket/websocket-setup';
import { setupSSEInspector } from './sse/sse-setup';
import type { NetworkInspectorConfig } from './config';

type InspectorsConfig = {
    eventsListener: ReturnType<typeof createEventsListener<NetworkActivityEventMap>>;
    httpInspector: ReturnType<typeof setupHTTPInspector>;
    webSocketInspector: ReturnType<typeof setupWebSocketInspector>;
    sseInspector: ReturnType<typeof setupSSEInspector>;
}

let inspectorsConfig: InspectorsConfig;

let bootRecordingEnabled = false;

export type BootRecordingOptions = NetworkInspectorConfig & EventsListenerOptions & {
  /**
   * Enable queuing of events during boot before DevTools connects.
   * When true, network activity is captured and queued until DevTools is ready.
   * When false, nothing is queued and inspectors are not even set up.
   * @default true
   */
  enableBootRecording?: boolean;
};

/**
 * 
 * @internal
 */
export const createDefaultInspectorsConfig = (
  options?: BootRecordingOptions,
) => {
  if(inspectorsConfig) {
    return inspectorsConfig;
  }
    
  bootRecordingEnabled = options?.enableBootRecording ?? true;
  const maxQueueSize = options?.maxQueueSize ?? 200;
  const inspectors = {
      http: true,
      websocket: true,
      sse: true,
      ...options?.inspectors,
    };

  const eventsListener = createEventsListener<NetworkActivityEventMap>();
  eventsListener.setMaxQueueSize(maxQueueSize);

  const httpInspector = setupHTTPInspector(eventsListener, bootRecordingEnabled && inspectors.http);
  const webSocketInspector = setupWebSocketInspector(eventsListener, bootRecordingEnabled && inspectors.websocket);
  const sseInspector = setupSSEInspector(eventsListener, bootRecordingEnabled && inspectors.sse);

  if (bootRecordingEnabled) {
    eventsListener.enableQueuing();  
  }

  inspectorsConfig = {
    eventsListener,
    httpInspector,
    webSocketInspector,
    sseInspector,
  };

  return inspectorsConfig;
};

/**
 * Enable network activity recording during app boot, before DevTools connects.
 * Call this at the root of your app to capture early network requests.
 * 
 * @example
 * ```tsx
 * import { withOnBootNetworkActivityRecording } from '@rozenite/network-activity-plugin';
 * 
 * // At app entry point, before any network requests
 * withOnBootNetworkActivityRecording();
 * 
 * function App() {
 *   useNetworkActivityDevTools();
 *   // ...
 * }
 * ```
 */
export const withOnBootNetworkActivityRecording = (options?: BootRecordingOptions) => {
  createDefaultInspectorsConfig(options);
}