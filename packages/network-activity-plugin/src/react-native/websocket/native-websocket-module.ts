import { TurboModuleRegistry } from 'react-native';

/**
 * Mirrors React Native's internal `WebSocketModule` TurboModule spec
 * (`react-native/src/private/specs_DEPRECATED/modules/NativeWebSocketModule`).
 * Looked up by name via the public `TurboModuleRegistry` API instead of
 * importing the private spec module directly.
 */
export interface NativeWebSocketModule {
  getConstants?(): Record<string, unknown>;
  connect(
    url: string,
    protocols: string[] | null,
    options: { headers?: Record<string, unknown> },
    socketId: number,
  ): void;
  send(message: string, forSocketID: number): void;
  sendBinary(base64String: string, forSocketID: number): void;
  ping(socketID: number): void;
  close(...args: [code: number, reason: string, socketID: number] | [socketID: number]): void;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export const getNativeWebSocketModule = (): NativeWebSocketModule => {
  return TurboModuleRegistry.getEnforcing<NativeWebSocketModule>('WebSocketModule');
};
