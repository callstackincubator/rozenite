import { Platform } from 'react-native';
import WebSocketInterceptor from 'react-native/Libraries/WebSocket/WebSocketInterceptor';

export interface WebSocketInterceptor {
  /**
   * Invoked when RCTWebSocketModule.close(...) is called.
   */
  setCloseCallback(
    callback: (
      code: number | null,
      reason: string | null,
      socketId: number
    ) => void
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
      socketId: number
    ) => void
  ): void;

  /**
   * Invoked when event "websocketOpen" happens.
   */
  setOnOpenCallback(callback: (socketId: number) => void): void;

  /**
   * Invoked when event "websocketMessage" happens.
   */
  setOnMessageCallback(
    callback: (data: string, socketId: number) => void
  ): void;

  /**
   * Invoked when event "websocketFailed" happens.
   */
  setOnErrorCallback(callback: (error: string, socketId: number) => void): void;

  /**
   * Invoked when event "websocketClosed" happens.
   */
  setOnCloseCallback(
    callback: (
      error: { code: number; reason?: string },
      socketId: number
    ) => void
  ): void;

  isInterceptorEnabled(): boolean;
  enableInterception(): void;
  disableInterception(): void;
}

export interface WebSocketInterceptorPreRN079 {
  /**
   * Invoked when RCTWebSocketModule.close(...) is called.
   */
  setCloseCallback(
    callback: (
      code: number | null,
      reason: string | null,
      socketId: number
    ) => void
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
      socketId: number
    ) => void
  ): void;

  /**
   * Invoked when event "websocketOpen" happens.
   */
  setOnOpenCallback(callback: (socketId: number) => void): void;

  /**
   * Invoked when event "websocketMessage" happens.
   */
  setOnMessageCallback(
    callback: (socketId: number, data: string) => void
  ): void;

  /**
   * Invoked when event "websocketFailed" happens.
   */
  setOnErrorCallback(callback: (socketId: number, error: string) => void): void;

  /**
   * Invoked when event "websocketClosed" happens.
   */
  setOnCloseCallback(
    callback: (
      socketId: number,
      error: { code: number; reason?: string }
    ) => void
  ): void;

  isInterceptorEnabled(): boolean;
  enableInterception(): void;
  disableInterception(): void;
}

export const getWebSocketInterceptor = (): WebSocketInterceptor => {
  /**
   * Note: RN 0.79 changed the order of the arguments.
   * @see https://github.com/facebook/react-native/commit/d2adb976abebcb0f38750903d98fbb5a3f50924b
   */

  if (Platform.constants.reactNativeVersion.minor >= 79) {
    return WebSocketInterceptor as WebSocketInterceptor;
  } else {
    const WebSocketInterceptorPreRN079 =
      WebSocketInterceptor as WebSocketInterceptorPreRN079;

    return {
      ...WebSocketInterceptorPreRN079,
      setOnMessageCallback: (
        callback: (data: string, socketId: number) => void
      ) => {
        WebSocketInterceptorPreRN079.setOnMessageCallback((socketId, data) => {
          callback(data, socketId);
        });
      },
      setOnCloseCallback: (
        callback: (
          error: { code: number; reason?: string },
          socketId: number
        ) => void
      ) => {
        WebSocketInterceptorPreRN079.setOnCloseCallback((error, socketId) => {
          callback(socketId, error);
        });
      },
      setOnErrorCallback: (
        callback: (error: string, socketId: number) => void
      ) => {
        WebSocketInterceptorPreRN079.setOnErrorCallback((error, socketId) => {
          callback(socketId, error);
        });
      },
    } as WebSocketInterceptor;
  }
};
