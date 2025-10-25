import { NetworkActivityDevToolsClient } from '../../shared/client';
import { getNetworkRequestsRegistry } from './network-requests-registry';
import { getOverridesRegistry } from './overrides-registry';
import {
  BootClientOptions,
  getQueuedClientWrapper,
} from './queued-client-wrapper';
import { XHRInterceptor } from './xhr-interceptor';
import {
  setupRequestTracking,
  setupRequestOverride,
  getResponseBody,
} from './request-tracker';

const networkRequestsRegistry = getNetworkRequestsRegistry();
const overridesRegistry = getOverridesRegistry();
const queuedClient = getQueuedClientWrapper();

const setupXHRInterceptor = (): void => {
  if (XHRInterceptor.isInterceptorEnabled()) return;
  XHRInterceptor.disableInterception();
  XHRInterceptor.setSendCallback((data, request) =>
    setupRequestTracking(queuedClient, networkRequestsRegistry, data, request),
  );
  XHRInterceptor.setOverrideCallback((request) =>
    setupRequestOverride(overridesRegistry, request),
  );
  XHRInterceptor.enableInterception();
};

export type BootRecordingOptions = BootClientOptions;

/**
 * Enable XHR interception early to capture boot-time requests.
 */
const enableBootTimeInterception = (options?: BootRecordingOptions): void => {
  queuedClient.setMaxQueueSize(options?.maxQueueSize ?? 200);

  if (queuedClient.isBootInterceptionEnabled()) {
    return;
  }

  queuedClient.enableBootInterception();
  setupXHRInterceptor();
};

export const withOnBootNetworkActivityRecording = (
  options?: BootRecordingOptions,
): void => {
  enableBootTimeInterception(options);
};

export type NetworkInspector = {
  enable: () => void;
  disable: () => void;
  isEnabled: () => boolean;
  dispose: () => void;
};

export const getNetworkInspector = (
  pluginClient: NetworkActivityDevToolsClient,
): NetworkInspector => {
  const queuedClient = getQueuedClientWrapper();
  queuedClient.setClient(pluginClient);

  const enable = () => {
    // Switch mode to send queued messages when needed
    queuedClient.enableClientMode();
    setupXHRInterceptor();
  };

  const disable = () => {
    XHRInterceptor.disableInterception();
    networkRequestsRegistry.clear();
  };

  const isEnabled = () => {
    return XHRInterceptor.isInterceptorEnabled();
  };

  const enableSubscription = pluginClient.onMessage('network-enable', () => {
    enable();
  });

  const disableSubscription = pluginClient.onMessage('network-disable', () => {
    disable();
  });

  const handleBodySubscription = pluginClient.onMessage(
    'get-response-body',
    async ({ requestId }) => {
      const request = networkRequestsRegistry.getEntry(requestId);

      if (!request) {
        return;
      }

      const body = await getResponseBody(request);

      pluginClient.send('response-body', {
        requestId,
        body,
      });
    },
  );

  const dispose = () => {
    disable();
    enableSubscription.remove();
    disableSubscription.remove();
    handleBodySubscription.remove();
  };

  return {
    enable,
    disable,
    isEnabled,
    dispose,
  };
};
