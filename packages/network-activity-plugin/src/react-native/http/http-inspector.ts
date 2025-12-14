import { createNanoEvents } from 'nanoevents';  
import { getNetworkRequestsRegistry } from './network-requests-registry';
import { XHRInterceptor } from './xhr-interceptor';
import { getRequestBody, getResponseSize, getInitiatorFromStack } from './http-utils';
import { applyReactNativeResponseHeadersLogic } from '../../utils/applyReactNativeResponseHeadersLogic';
import { getContentType } from '../utils';
import type { NetworkActivityEventMap, HttpMethod } from '../../shared/client';

// HTTP-specific event map for the inspector
type HttpEventMap = Pick<
  NetworkActivityEventMap,
  'request-sent' | 'response-received' | 'request-completed' | 'request-failed'
>;

type NanoEventsMap = {
  [K in keyof HttpEventMap]: (data: HttpEventMap[K]) => void;
};

export type HTTPInspector = {
  enable: () => void;
  disable: () => void;
  isEnabled: () => boolean;
  dispose: () => void;
  getNetworkRequestsRegistry: () => ReturnType<typeof getNetworkRequestsRegistry>;
  on: <TEventType extends keyof HttpEventMap>(
    event: TEventType,
    callback: (data: HttpEventMap[TEventType]) => void
  ) => () => void;
};

const READY_STATE_HEADERS_RECEIVED = 2;

export const getHTTPInspector = (): HTTPInspector => {
  const eventEmitter = createNanoEvents<NanoEventsMap>();
  const networkRequestsRegistry = getNetworkRequestsRegistry();

  return {
    enable: () => {
      if (XHRInterceptor.isInterceptorEnabled()) return;

      XHRInterceptor.disableInterception();
      
      XHRInterceptor.setSendCallback((data, request) => {
        const initiator = getInitiatorFromStack();
        const sendTime = Date.now();
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

        request._rozeniteRequestId = requestId;
        networkRequestsRegistry.addEntry(requestId, request);

        let ttfb = 0;

        eventEmitter.emit('request-sent', {
          requestId: requestId,
          timestamp: sendTime,
          request: {
            url: request._url as string,
            method: request._method as HttpMethod,
            headers: request._headers,
            postData: getRequestBody(data),
          },
          type: 'XHR',
          initiator,
        });

        request.addEventListener('readystatechange', () => {
          if (request.readyState === READY_STATE_HEADERS_RECEIVED) {
            ttfb = Date.now() - sendTime;
          }
        });

        request.addEventListener('load', () => {
          eventEmitter.emit('response-received', {
            requestId: requestId,
            timestamp: Date.now(),
            type: 'XHR',
            response: {
              url: request._url as string,
              status: request.status,
              statusText: request.statusText,
              headers: applyReactNativeResponseHeadersLogic(
                request.responseHeaders || {},
              ),
              contentType: getContentType(request),
              size: getResponseSize(request),
              responseTime: Date.now(),
            },
          });
        });

        request.addEventListener('loadend', () => {
          eventEmitter.emit('request-completed', {
            requestId: requestId,
            timestamp: Date.now(),
            duration: Date.now() - sendTime,
            size: getResponseSize(request),
            ttfb,
          });
        });

        request.addEventListener('error', () => {
          eventEmitter.emit('request-failed', {
            requestId: requestId,
            timestamp: Date.now(),
            type: 'XHR',
            error: 'Failed',
            canceled: false,
          });
        });

        request.addEventListener('abort', () => {
          eventEmitter.emit('request-failed', {
            requestId: requestId,
            timestamp: Date.now(),
            type: 'XHR',
            error: 'Aborted',
            canceled: true,
          });
        });
      });

      XHRInterceptor.enableInterception();
    },

    disable: () => {
      XHRInterceptor.disableInterception();
      networkRequestsRegistry.clear();
    },

    isEnabled: () => {
      return XHRInterceptor.isInterceptorEnabled();
    },

    dispose: () => {
      XHRInterceptor.disableInterception();
      networkRequestsRegistry.clear();
    },

    getNetworkRequestsRegistry: () => networkRequestsRegistry,

    on: <TEventType extends keyof HttpEventMap>(event: TEventType, callback: (data: HttpEventMap[TEventType]) => void) => {
      // Cast to work around TypeScript intersection type limitations with nanoevents
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return eventEmitter.on(event as any, callback as any);
    },
  };
};
