import type EventSource from 'react-native-sse';
import type {
  MessageEvent,
  ErrorEvent,
  OpenEvent,
  CloseEvent,
  TimeoutEvent,
  ExceptionEvent,
} from 'react-native-sse';
import { EventSourceWithInternals } from './types';
import { getEventSource } from './event-source';

export type SSEInterceptorConnectCallback = (
  url: string,
  request: EventSource
) => void;

export type SSEInterceptorMessageCallback = (
  event: MessageEvent,
  request: EventSource
) => void;

export type SSEInterceptorErrorCallback = (
  error: ErrorEvent | TimeoutEvent | ExceptionEvent,
  request: EventSource
) => void;

export type SSEInterceptorOpenEventCallback = (
  event: OpenEvent,
  request: EventSource
) => void;

export type SSEInterceptorCloseCallback = (
  event: CloseEvent,
  request: EventSource
) => void;

let connectCallback: SSEInterceptorConnectCallback | null;
let messageCallback: SSEInterceptorMessageCallback | null;
let errorCallback: SSEInterceptorErrorCallback | null;
let openEventCallback: SSEInterceptorOpenEventCallback | null;
let closeCallback: SSEInterceptorCloseCallback | null;

let isInterceptorEnabled = false;

const eventSourceClass = getEventSource();

// Store original EventSource open method
const originalOpen = eventSourceClass.prototype.open;

/**
 * A network interceptor which monkey-patches EventSource open method
 * to gather all SSE connections and events, in order to show their
 * information in the Network Activity panel.
 */
export const SSEInterceptor = {
  /**
   * Invoked when EventSource.open() is called (connection attempt starting).
   */
  setConnectCallback(callback: SSEInterceptorConnectCallback) {
    connectCallback = callback;
  },

  /**
   * Invoked when a message event is received.
   */
  setMessageCallback(callback: SSEInterceptorMessageCallback) {
    messageCallback = callback;
  },

  /**
   * Invoked when an error event occurs.
   */
  setErrorCallback(callback: SSEInterceptorErrorCallback) {
    errorCallback = callback;
  },

  /**
   * Invoked when the connection is successfully opened (open event fired).
   */
  setOpenEventCallback(callback: SSEInterceptorOpenEventCallback) {
    openEventCallback = callback;
  },

  /**
   * Invoked when the connection is closed.
   */
  setCloseCallback(callback: SSEInterceptorCloseCallback) {
    closeCallback = callback;
  },

  isInterceptorEnabled(): boolean {
    return isInterceptorEnabled;
  },

  enableInterception() {
    if (isInterceptorEnabled) {
      return;
    }

    // Override EventSource open method to intercept SSE connections
    eventSourceClass.prototype.open = function (
      this: EventSourceWithInternals
    ) {
      // Invoke connect callback
      if (connectCallback) {
        connectCallback(this.url, this);
      }

      // Add event listeners to intercept all events
      this.addEventListener('open', (event: OpenEvent) => {
        if (openEventCallback) {
          openEventCallback(event, this);
        }
      });

      this.addEventListener('message', (event: MessageEvent) => {
        if (messageCallback) {
          messageCallback(event, this);
        }
      });

      this.addEventListener(
        'error',
        (event: ErrorEvent | TimeoutEvent | ExceptionEvent) => {
          if (errorCallback) {
            errorCallback(event, this);
          }
        }
      );

      this.addEventListener('close', (event: CloseEvent) => {
        if (closeCallback) {
          closeCallback(event, this);
        }
      });

      // Call original open method
      return originalOpen.call(this);
    };

    isInterceptorEnabled = true;
  },

  // Unpatch EventSource open method and remove the callbacks.
  disableInterception() {
    if (!isInterceptorEnabled) {
      return;
    }
    isInterceptorEnabled = false;

    // Restore original open method
    eventSourceClass.prototype.open = originalOpen;

    // Clear callbacks
    connectCallback = null;
    messageCallback = null;
    errorCallback = null;
    openEventCallback = null;
    closeCallback = null;
  },
};
