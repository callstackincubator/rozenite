import { createNanoEvents } from 'nanoevents';
import { SSEInterceptor } from './sse-interceptor';
import { EventSourceWithInternals } from './types';
import { SSEEvent, SSEEventMap } from '../../shared/sse-events';
import { getContentType } from '../utils';

type NanoEventsMap = {
  [K in keyof SSEEventMap]: (data: SSEEventMap[K]) => void;
};

export type SSEInspector = {
  enable: () => void;
  disable: () => void;
  isEnabled: () => boolean;
  dispose: () => void;
  on: <TEventType extends keyof SSEEventMap>(
    event: TEventType,
    callback: (data: SSEEventMap[TEventType]) => void
  ) => () => void;
};

export const getSSEInspector = (): SSEInspector => {
  const eventEmitter = createNanoEvents<NanoEventsMap>();

  const getRequestId = (eventSource: EventSourceWithInternals): string => {
    const requestId = eventSource._xhr?._rozeniteRequestId;

    if (!requestId) {
      throw new Error(
        'No request ID found for EventSource. This should never happen!'
      );
    }

    return requestId;
  };

  return {
    enable: () => {
      SSEInterceptor.setOpenEventCallback((_, eventSource) => {
        const sseEventSource = eventSource as EventSourceWithInternals;
        const requestId = getRequestId(sseEventSource);
        const sseXhr = sseEventSource._xhr as XMLHttpRequest;

        const event: SSEEvent = {
          type: 'sse-open',
          requestId,
          timestamp: Date.now(),
          response: {
            url: sseXhr._url as string,
            status: sseXhr.status,
            statusText: sseXhr.statusText,
            headers: sseXhr.responseHeaders || {},
            contentType: getContentType(sseXhr),
            size: 0,
            responseTime: Date.now(),
          },
        };
        eventEmitter.emit('sse-open', event);
      });

      SSEInterceptor.setMessageCallback((messageEvent, eventSource) => {
        const sseEventSource = eventSource as EventSourceWithInternals;
        const requestId = getRequestId(sseEventSource);

        const event: SSEEvent = {
          type: 'sse-message',
          requestId,
          timestamp: Date.now(),
          payload: {
            type: messageEvent.type,
            data: messageEvent.data || '',
          },
        };
        eventEmitter.emit('sse-message', event);
      });

      SSEInterceptor.setErrorCallback((errorEvent, eventSource) => {
        const sseEventSource = eventSource as EventSourceWithInternals;
        const requestId = getRequestId(sseEventSource);

        const event: SSEEvent = {
          type: 'sse-error',
          requestId,
          timestamp: Date.now(),
          error: {
            type: errorEvent.type,
            message:
              errorEvent.type === 'timeout' ? 'Timeout' : errorEvent.message,
          },
        };
        eventEmitter.emit('sse-error', event);
      });

      SSEInterceptor.setCloseCallback((_, eventSource) => {
        const sseEventSource = eventSource as EventSourceWithInternals;
        const requestId = getRequestId(sseEventSource);

        const event: SSEEvent = {
          type: 'sse-close',
          requestId,
          timestamp: Date.now(),
        };
        eventEmitter.emit('sse-close', event);
      });

      SSEInterceptor.enableInterception();
    },
    disable: () => {
      SSEInterceptor.disableInterception();
    },
    isEnabled: () => SSEInterceptor.isInterceptorEnabled(),
    dispose: () => {
      SSEInterceptor.disableInterception();
      eventEmitter.events = {};
    },
    on: <TEventType extends keyof SSEEventMap>(
      event: TEventType,
      callback: (data: SSEEventMap[TEventType]) => void
    ) => eventEmitter.on(event, callback as NanoEventsMap[TEventType]),
  };
};
