import { NetworkActivityEventMap } from '../shared/client';
import { createEventsListener, EventsListenerOptions } from './events-listener';
import { getNetworkInspector, NetworkInspector } from './network-inspector';
import { validateConfig, type NetworkInspectorConfig } from './config';

type InspectorsConfiguration = {
  eventsListener: ReturnType<
    typeof createEventsListener<NetworkActivityEventMap>
  >;
  networkInspector: NetworkInspector;
};

let inspectorsConfig: InspectorsConfiguration;

let bootRecordingEnabled = false;

export type BootRecordingOptions = NetworkInspectorConfig &
  EventsListenerOptions & {
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
export const createNetworkInspectorsConfiguration = (
  options?: BootRecordingOptions,
) => {
  if (inspectorsConfig) {
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

  validateConfig({ inspectors });

  const eventsListener = createEventsListener<NetworkActivityEventMap>();
  eventsListener.setMaxQueueSize(maxQueueSize);

  const networkInspector = getNetworkInspector();
  networkInspector.setup(eventsListener);

  if (bootRecordingEnabled) {
    eventsListener.enableQueuing();
    networkInspector.enable(inspectors);
  }

  inspectorsConfig = {
    eventsListener,
    networkInspector,
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
export const withOnBootNetworkActivityRecording = (
  options?: BootRecordingOptions,
) => {
  createNetworkInspectorsConfiguration(options);
};
