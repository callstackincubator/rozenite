import { NetworkActivityEventMap } from '../shared/client';
import { createEventsListener, EventsListenerOptions } from './events-listener';
import { setupHTTPInspector } from './http/http-setup';
import { setupWebSocketInspector } from './websocket/websocket-setup';
import { setupSSEInspector } from './sse/sse-setup';
import type { NetworkInspectorConfig } from './config';

// Singleton events listener instance for Network Activity events (HTTP, WebSocket, SSE)
const eventsListener = createEventsListener<NetworkActivityEventMap>();

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
export const withOnBootNetworkActivityRecording = (
  options?: BootRecordingOptions,
): void => {
  bootRecordingEnabled = options?.enableBootRecording ?? true;
  const maxQueueSize = options?.maxQueueSize ?? 200;
  const inspectors = {
      http: true,
      websocket: true,
      sse: true,
      ...options?.inspectors,
    };

  eventsListener.setMaxQueueSize(maxQueueSize);

  // Enable queuing if boot recording is requested
  if (bootRecordingEnabled) {
    eventsListener.enableQueuing();
  
    if (inspectors?.http) {
        setupHTTPInspector(eventsListener, true);
    }
    if (inspectors?.websocket) {
        setupWebSocketInspector(eventsListener, true);
    }
    if (inspectors?.sse) {
        setupSSEInspector(eventsListener, true);
    }
  }
};

/**
 * Get the shared events listener instance
 * @internal
 */
export const getNetworkActivityEventsListener = () => eventsListener;
