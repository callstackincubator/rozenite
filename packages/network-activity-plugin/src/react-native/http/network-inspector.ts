import { NetworkActivityDevToolsClient } from '../../shared/client';
import { getNetworkRequestsRegistry } from './network-requests-registry';
import { getOverridesRegistry } from './overrides-registry';
import { getQueuedClientWrapper } from './queued-client-wrapper';
import { XHRInterceptor } from './xhr-interceptor';
import {
  setupRequestTracking,
  setupRequestOverride,
  getResponseBody,
} from './request-tracker';

const networkRequestsRegistry = getNetworkRequestsRegistry();
const overridesRegistry = getOverridesRegistry();

const setupXHRInterceptor = (queuedClient: ReturnType<typeof getQueuedClientWrapper>): void => {
  XHRInterceptor.disableInterception();
  XHRInterceptor.setSendCallback((data, request) => 
    setupRequestTracking(queuedClient, networkRequestsRegistry, data, request)
  );
  XHRInterceptor.setOverrideCallback((request) => 
    setupRequestOverride(overridesRegistry, request)
  );
  XHRInterceptor.enableInterception();
};

/**
 * Enable XHR interception early to capture boot-time requests.
 */
const enableBootTimeInterception = (): void => {
  const queuedClient = getQueuedClientWrapper();
  
  if (queuedClient.isBootInterceptionEnabled()) {
    return;
  }
  
  queuedClient.enableBootInterception(); 
  setupXHRInterceptor(queuedClient);
};


export const withOnBootNetworkActivityRecording = (): void => {
  enableBootTimeInterception();
};

export type NetworkInspector = {
  enable: () => void;
  disable: () => void;
  isEnabled: () => boolean;
  dispose: () => void;
};

export const getNetworkInspector = (
  pluginClient: NetworkActivityDevToolsClient
): NetworkInspector => {
  const queuedClient = getQueuedClientWrapper();
  queuedClient.setClient(pluginClient);

  const enable = () => {
    if (queuedClient.isBootInterceptionEnabled()) {
      // Boot interception is already active, just switch mode and flush queue
      queuedClient.enableClient();
      queuedClient.flushQueue();
    } else {
      setupXHRInterceptor(queuedClient);
    }
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
    }
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
