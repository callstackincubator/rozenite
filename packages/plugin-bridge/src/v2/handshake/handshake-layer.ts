import { Channel } from '../../channel/types.js';
import { Subscription } from '../../types.js';
import {
  HandshakeMessage,
  HandshakeState,
  HANDSHAKE_INIT,
  HANDSHAKE_ACK,
  HANDSHAKE_COMPLETE,
  isHandshakeMessage,
} from './types.js';

export type UserMessage = {
  type: string;
  payload: unknown;
};

type MessageListener = (message: UserMessage) => void;

export type QueuedMessage = {
  pluginId: string;
  type: string;
  payload: unknown;
};

export type HandshakeLayer = {
  initialize: () => Promise<void>;
  send: (type: string, payload: unknown) => void;
  onMessage: (listener: MessageListener) => Subscription;
  signalReady: () => void;
  onReady: (callback: () => void) => Subscription;
  isReady: () => boolean;
  close: () => void;
};

export const createHandshakeLayer = (
  channel: Channel,
  pluginId: string,
  isLeader: boolean
): HandshakeLayer => {
  const state = {
    channel,
    pluginId,
    isLeader,
    state: HandshakeState.NOT_STARTED,
    outgoingMessageQueue: [] as QueuedMessage[],
    incomingMessageQueue: [] as UserMessage[],
    readyListeners: new Set<() => void>(),
    userMessageListeners: new Set<MessageListener>(),
    channelSubscription: null as Subscription | null,
  };

  const handleIncomingMessage = (message: unknown): void => {
    const devToolsMessage = parseDevToolsMessage(message);
    if (!devToolsMessage || devToolsMessage.pluginId !== state.pluginId) {
      return;
    }

    if (isHandshakeMessage(devToolsMessage)) {
      handleHandshakeMessage(devToolsMessage);
    } else {
      handleUserMessage(devToolsMessage);
    }
  };

  const parseDevToolsMessage = (message: unknown): { pluginId: string; type: string; payload: unknown } | null => {
    if (typeof message !== 'object' || message === null) {
      return null;
    }

    const msg = message as Record<string, unknown>;
    if (typeof msg.pluginId !== 'string' || typeof msg.type !== 'string') {
      return null;
    }

    return {
      pluginId: msg.pluginId,
      type: msg.type,
      payload: msg.payload,
    };
  };

  const handleHandshakeMessage = (message: HandshakeMessage): void => {
    switch (message.type) {
      case HANDSHAKE_INIT:
        if (!state.isLeader && state.state === HandshakeState.NOT_STARTED) {
          sendHandshakeMessage(HANDSHAKE_ACK);
          state.state = HandshakeState.WAITING_FOR_COMPLETE;
        }
        break;

      case HANDSHAKE_ACK:
        if (state.isLeader && state.state === HandshakeState.WAITING_FOR_ACK) {
          sendHandshakeMessage(HANDSHAKE_COMPLETE);
          state.state = HandshakeState.READY;
          flushMessageQueues();
          notifyReady();
        }
        break;

      case HANDSHAKE_COMPLETE:
        if (!state.isLeader && state.state === HandshakeState.WAITING_FOR_COMPLETE) {
          state.state = HandshakeState.READY;
          flushMessageQueues();
          notifyReady();
        }
        break;
    }
  };

  const handleUserMessage = (message: { pluginId: string; type: string; payload: unknown }): void => {
    const userMessage: UserMessage = {
      type: message.type,
      payload: message.payload,
    };

    if (state.state === HandshakeState.READY) {
      // Forward immediately if handshake is complete
      state.userMessageListeners.forEach((listener) => {
        listener(userMessage);
      });
    } else {
      // Queue incoming messages until handshake completes
      state.incomingMessageQueue.push(userMessage);
    }
  };

  const sendHandshakeMessage = (type: HandshakeMessage['type']): void => {
    state.channel.send({
      pluginId: state.pluginId,
      type,
      payload: null,
    });
  };

  const send = (type: string, payload: unknown): void => {
    const message: QueuedMessage = {
      pluginId: state.pluginId,
      type,
      payload,
    };

    if (state.state === HandshakeState.READY) {
      sendMessage(message);
    } else {
      state.outgoingMessageQueue.push(message);
    }
  };

  const sendMessage = (message: QueuedMessage): void => {
    state.channel.send({
      pluginId: message.pluginId,
      type: message.type,
      payload: message.payload,
    });
  };

  const onMessage = (listener: MessageListener): Subscription => {
    state.userMessageListeners.add(listener);

    return {
      remove: () => {
        state.userMessageListeners.delete(listener);
      },
    };
  };

  const signalReady = (): void => {
    if (state.state !== HandshakeState.NOT_STARTED) {
      // Already in progress or ready
      return;
    }

    if (state.isLeader) {
      // DevTools UI initiates
      sendHandshakeMessage(HANDSHAKE_INIT);
      state.state = HandshakeState.WAITING_FOR_ACK;
    } else {
      // Device responds to init
      // This should be called after receiving HANDSHAKE_INIT
      // but we handle that in handleHandshakeMessage
    }
  };

  const onReady = (callback: () => void): Subscription => {
    if (state.state === HandshakeState.READY) {
      // Already ready, call immediately
      setTimeout(callback, 0);
    }

    state.readyListeners.add(callback);

    return {
      remove: () => {
        state.readyListeners.delete(callback);
      },
    };
  };

  const isReady = (): boolean => {
    return state.state === HandshakeState.READY;
  };

  const flushMessageQueues = (): void => {
    // Flush outgoing messages
    state.outgoingMessageQueue.forEach((message) => {
      sendMessage(message);
    });
    state.outgoingMessageQueue = [];

    // Flush incoming messages
    state.incomingMessageQueue.forEach((message) => {
      state.userMessageListeners.forEach((listener) => {
        listener(message);
      });
    });
    state.incomingMessageQueue = [];
  };

  const notifyReady = (): void => {
    state.readyListeners.forEach((callback) => {
      setTimeout(callback, 0);
    });
  };

  const initialize = async (): Promise<void> => {
    state.channelSubscription = state.channel.onMessage(handleIncomingMessage);
  };

  const close = (): void => {
    state.channelSubscription?.remove();
    state.readyListeners.clear();
    state.userMessageListeners.clear();
    state.outgoingMessageQueue = [];
    state.incomingMessageQueue = [];
    state.state = HandshakeState.NOT_STARTED;
  };

  return {
    initialize,
    send,
    onMessage,
    signalReady,
    onReady,
    isReady,
    close,
  };
};
