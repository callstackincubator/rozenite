import { NetworkActivityEventMap } from '../shared/client';
import { createEventsListener, EventsListenerOptions } from './events-listener';
import { setupHTTPInspector, getHTTPInspectorInstance } from './http/http-setup';
import { setupWebSocketInspector, getWebSocketInspectorInstance } from './websocket/websocket-setup';
import { setupSSEInspector, getSSEInspectorInstance } from './sse/sse-setup';

// Singleton events listener instance for Network Activity events (HTTP, WebSocket, SSE)
const eventsListener = createEventsListener<NetworkActivityEventMap>();

// Boot recording configuration
let bootRecordingEnabled = false;
let bootRecordingOptions: BootRecordingOptions = {};

export type BootRecordingOptions = EventsListenerOptions & {
  /**
   * Enable HTTP network activity recording
   * @default true
   */
  http?: boolean;
  /**
   * Enable WebSocket activity recording
   * @default true
   */
  websocket?: boolean;
  /**
   * Enable SSE (Server-Sent Events) activity recording
   * @default true
   */
  sse?: boolean;
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
  bootRecordingEnabled = true;
  bootRecordingOptions = {
    maxQueueSize: options?.maxQueueSize ?? 200,
    http: options?.http ?? true,
    websocket: options?.websocket ?? true,
    sse: options?.sse ?? true,
  };

  // Enable queuing mode on the events listener
  eventsListener.setMaxQueueSize(bootRecordingOptions.maxQueueSize ?? 200);
  eventsListener.enableQueuing();

  // Initialize and enable inspectors based on options
  if (bootRecordingOptions.http !== false) {
    setupHTTPInspector(eventsListener);
    // Enable the inspector to start capturing boot-time HTTP requests
    const httpInspector = getHTTPInspectorInstance(eventsListener);
    httpInspector.enable();
  }
  if (bootRecordingOptions.websocket !== false) {
    setupWebSocketInspector(eventsListener);
    // Enable the inspector to start capturing boot-time WebSocket connections
    const websocketInspector = getWebSocketInspectorInstance(eventsListener);
    websocketInspector.enable();
  }
  if (bootRecordingOptions.sse !== false) {
    setupSSEInspector(eventsListener);
    // Enable the inspector to start capturing boot-time SSE connections
    const sseInspector = getSSEInspectorInstance(eventsListener);
    sseInspector.enable();
  }
};

/**
 * Check if boot recording is enabled
 * @internal
 */
export const isBootRecordingEnabled = () => bootRecordingEnabled;

/**
 * Get boot recording options
 * @internal
 */
export const getBootRecordingOptions = () => bootRecordingOptions;

/**
 * Get the shared events listener instance
 * @internal
 */
export const getNetworkActivityEventsListener = () => eventsListener;
