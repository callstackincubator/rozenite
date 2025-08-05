import { createNanoEvents } from 'nanoevents';
import { getWebSocketInterceptor } from './websocket-interceptor';
import {
  WebSocketEvent,
  WebSocketEventMap,
} from '../../shared/websocket-events';

type NanoEventsMap = {
  [K in keyof WebSocketEventMap]: (data: WebSocketEventMap[K]) => void;
};

export type WebSocketInspector = {
  enable: () => void;
  disable: () => void;
  isEnabled: () => boolean;
  dispose: () => void;
  on: <TEventType extends keyof WebSocketEventMap>(
    event: TEventType,
    callback: (data: WebSocketEventMap[TEventType]) => void
  ) => () => void;
};

export const getWebSocketInspector = (): WebSocketInspector => {
  const eventEmitter = createNanoEvents<NanoEventsMap>();
  const socketUrlMap = new Map<number, string>();
  const webSocketInterceptor = getWebSocketInterceptor();

  return {
    enable: () => {
      webSocketInterceptor.setConnectCallback(
        (
          url: string,
          protocols: string[] | null,
          options: string[],
          socketId: number
        ) => {
          socketUrlMap.set(socketId, url);
          const event: WebSocketEvent = {
            type: 'websocket-connect',
            url,
            socketId,
            timestamp: Date.now(),
            protocols,
            options,
          };
          eventEmitter.emit('websocket-connect', event);
        }
      );

      webSocketInterceptor.setCloseCallback(
        (code: number | null, reason: string | null, socketId: number) => {
          const url = socketUrlMap.get(socketId);

          if (!url) {
            return;
          }

          const event: WebSocketEvent = {
            type: 'websocket-close',
            url,
            socketId,
            timestamp: Date.now(),
            code: code || 0,
            reason: reason || undefined,
          };
          eventEmitter.emit('websocket-close', event);
          socketUrlMap.delete(socketId);
        }
      );

      webSocketInterceptor.setOnMessageCallback(
        (data: string, socketId: number) => {
          const url = socketUrlMap.get(socketId);

          if (!url) {
            return;
          }

          const event: WebSocketEvent = {
            type: 'websocket-message-received',
            url,
            socketId,
            timestamp: Date.now(),
            data,
            messageType: typeof data === 'string' ? 'text' : 'binary',
          };
          eventEmitter.emit('websocket-message-received', event);
        }
      );

      webSocketInterceptor.setOnErrorCallback(
        (error: string, socketId: number) => {
          const url = socketUrlMap.get(socketId);

          if (!url) {
            return;
          }

          const event: WebSocketEvent = {
            type: 'websocket-error',
            url,
            socketId,
            timestamp: Date.now(),
            error,
          };
          eventEmitter.emit('websocket-error', event);
        }
      );

      webSocketInterceptor.setSendCallback((data: string, socketId: number) => {
        const url = socketUrlMap.get(socketId);

        if (!url) {
          return;
        }

        const event: WebSocketEvent = {
          type: 'websocket-message-sent',
          url,
          socketId,
          timestamp: Date.now(),
          data,
          messageType: typeof data === 'string' ? 'text' : 'binary',
        };
        eventEmitter.emit('websocket-message-sent', event);
      });

      webSocketInterceptor.setOnOpenCallback((socketId: number) => {
        const url = socketUrlMap.get(socketId);

        if (!url) {
          return;
        }

        const event: WebSocketEvent = {
          type: 'websocket-open',
          url,
          socketId,
          timestamp: Date.now(),
        };
        eventEmitter.emit('websocket-open', event);
      });

      webSocketInterceptor.setOnCloseCallback(
        (error: { code: number; reason?: string }, socketId: number) => {
          const url = socketUrlMap.get(socketId);

          if (!url) {
            return;
          }

          const event: WebSocketEvent = {
            type: 'websocket-close',
            url,
            socketId,
            timestamp: Date.now(),
            code: error.code,
            reason: error.reason,
          };
          eventEmitter.emit('websocket-close', event);
          socketUrlMap.delete(socketId);
        }
      );

      webSocketInterceptor.enableInterception();
    },
    disable: () => {
      webSocketInterceptor.disableInterception();
    },
    isEnabled: () => webSocketInterceptor.isInterceptorEnabled(),
    dispose: () => {
      eventEmitter.events = {};
      socketUrlMap.clear();
    },
    on: <TEventType extends keyof WebSocketEventMap>(
      event: TEventType,
      callback: (data: WebSocketEventMap[TEventType]) => void
    ) => eventEmitter.on(event, callback as NanoEventsMap[TEventType]),
  };
};
