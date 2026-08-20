import { NativeEventEmitter } from 'react-native';
import base64 from 'base64-js';
import { getNativeWebSocketModule } from './native-websocket-module';

export interface WebSocketInterceptor {
  /**
   * Invoked when RCTWebSocketModule.close(...) is called.
   */
  setCloseCallback(
    callback: (code: number | null, reason: string | null, socketId: number) => void,
  ): void;

  /**
   * Invoked when RCTWebSocketModule.send(...) or sendBinary(...) is called.
   */
  setSendCallback(callback: (data: string, socketId: number) => void): void;

  /**
   * Invoked when RCTWebSocketModule.connect(...) is called.
   */
  setConnectCallback(
    callback: (
      url: string,
      protocols: string[] | null,
      options: string[],
      socketId: number,
    ) => void,
  ): void;

  /**
   * Invoked when event "websocketOpen" happens.
   */
  setOnOpenCallback(callback: (socketId: number) => void): void;

  /**
   * Invoked when event "websocketMessage" happens.
   */
  setOnMessageCallback(callback: (data: string, socketId: number) => void): void;

  /**
   * Invoked when event "websocketFailed" happens.
   */
  setOnErrorCallback(callback: (error: string, socketId: number) => void): void;

  /**
   * Invoked when event "websocketClosed" happens.
   */
  setOnCloseCallback(
    callback: (error: { code: number; reason?: string }, socketId: number) => void,
  ): void;

  isInterceptorEnabled(): boolean;
  enableInterception(): void;
  disableInterception(): void;
}

/**
 * A network interceptor which monkey-patches the native WebSocket module to
 * gather all WebSocket network events.
 *
 * Vendored from React Native's internal (and now deprecated)
 * `Libraries/WebSocket/WebSocketInterceptor.js`, rebuilt on top of the
 * public `TurboModuleRegistry` / `NativeEventEmitter` APIs so this package
 * has no dependency on React Native's private module paths.
 * @see https://github.com/facebook/react-native/blob/main/packages/react-native/Libraries/WebSocket/WebSocketInterceptor.js
 */
export const getWebSocketInterceptor = (): WebSocketInterceptor => {
  const nativeWebSocketModule = getNativeWebSocketModule();

  const originalConnect = nativeWebSocketModule.connect.bind(nativeWebSocketModule);
  const originalSend = nativeWebSocketModule.send.bind(nativeWebSocketModule);
  const originalSendBinary = nativeWebSocketModule.sendBinary.bind(nativeWebSocketModule);
  const originalClose = nativeWebSocketModule.close.bind(nativeWebSocketModule);

  let eventEmitter: NativeEventEmitter | undefined;
  let subscriptions: { remove(): void }[] = [];

  let closeCallback: Parameters<WebSocketInterceptor['setCloseCallback']>[0] | null = null;
  let sendCallback: Parameters<WebSocketInterceptor['setSendCallback']>[0] | null = null;
  let connectCallback: Parameters<WebSocketInterceptor['setConnectCallback']>[0] | null = null;
  let onOpenCallback: Parameters<WebSocketInterceptor['setOnOpenCallback']>[0] | null = null;
  let onMessageCallback: Parameters<WebSocketInterceptor['setOnMessageCallback']>[0] | null = null;
  let onErrorCallback: Parameters<WebSocketInterceptor['setOnErrorCallback']>[0] | null = null;
  let onCloseCallback: Parameters<WebSocketInterceptor['setOnCloseCallback']>[0] | null = null;

  let isInterceptorEnabled = false;

  const arrayBufferToString = (data: string): string => {
    const value = base64.toByteArray(data).buffer;
    return `ArrayBuffer {${Array.from(new Uint8Array(value)).join(',')}}`;
  };

  const registerEvents = () => {
    if (!eventEmitter) {
      return;
    }

    subscriptions = [
      eventEmitter.addListener(
        'websocketMessage',
        (ev: { type?: 'binary' | 'text'; data: string; id: number }) => {
          onMessageCallback?.(ev.type === 'binary' ? arrayBufferToString(ev.data) : ev.data, ev.id);
        },
      ),
      eventEmitter.addListener('websocketOpen', (ev: { id: number }) => {
        onOpenCallback?.(ev.id);
      }),
      eventEmitter.addListener(
        'websocketClosed',
        (ev: { code: number; reason?: string; id: number }) => {
          onCloseCallback?.({ code: ev.code, reason: ev.reason }, ev.id);
        },
      ),
      eventEmitter.addListener('websocketFailed', (ev: { message: string; id: number }) => {
        onErrorCallback?.(ev.message, ev.id);
      }),
    ];
  };

  const unregisterEvents = () => {
    subscriptions.forEach((subscription) => subscription.remove());
    subscriptions = [];
  };

  return {
    setCloseCallback(callback) {
      closeCallback = callback;
    },
    setSendCallback(callback) {
      sendCallback = callback;
    },
    setConnectCallback(callback) {
      connectCallback = callback;
    },
    setOnOpenCallback(callback) {
      onOpenCallback = callback;
    },
    setOnMessageCallback(callback) {
      onMessageCallback = callback;
    },
    setOnErrorCallback(callback) {
      onErrorCallback = callback;
    },
    setOnCloseCallback(callback) {
      onCloseCallback = callback;
    },
    isInterceptorEnabled() {
      return isInterceptorEnabled;
    },
    enableInterception() {
      if (isInterceptorEnabled) {
        return;
      }

      eventEmitter = new NativeEventEmitter(nativeWebSocketModule);
      registerEvents();

      nativeWebSocketModule.connect = (url, protocols, options, socketId) => {
        connectCallback?.(url, protocols, options as unknown as string[], socketId);
        return originalConnect(url, protocols, options, socketId);
      };

      nativeWebSocketModule.send = (data, socketId) => {
        sendCallback?.(data, socketId);
        return originalSend(data, socketId);
      };

      nativeWebSocketModule.sendBinary = (data, socketId) => {
        sendCallback?.(arrayBufferToString(data), socketId);
        return originalSendBinary(data, socketId);
      };

      nativeWebSocketModule.close = (...args) => {
        if (closeCallback) {
          if (args.length === 3) {
            closeCallback(args[0], args[1], args[2]);
          } else {
            closeCallback(null, null, args[0]);
          }
        }
        return originalClose(...args);
      };

      isInterceptorEnabled = true;
    },
    disableInterception() {
      if (!isInterceptorEnabled) {
        return;
      }

      isInterceptorEnabled = false;

      nativeWebSocketModule.connect = originalConnect;
      nativeWebSocketModule.send = originalSend;
      nativeWebSocketModule.sendBinary = originalSendBinary;
      nativeWebSocketModule.close = originalClose;

      connectCallback = null;
      closeCallback = null;
      sendCallback = null;
      onOpenCallback = null;
      onMessageCallback = null;
      onCloseCallback = null;
      onErrorCallback = null;

      unregisterEvents();
    },
  };
};
