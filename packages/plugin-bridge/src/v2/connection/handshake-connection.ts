import { Channel } from '../../channel/types.js';
import { Subscription } from '../../types.js';
import {
  Connection,
  HandshakeConnectionConfig,
  HandshakeState,
  HandshakeStateType,
  HANDSHAKE_INIT,
  HANDSHAKE_ACK,
  HANDSHAKE_COMPLETE,
  isHandshakeMessage,
  isWireMessage,
  WireMessage,
} from './types.js';

type MessageListener = (message: WireMessage) => void;

type HandshakeConnectionState = {
  handshakeState: HandshakeStateType;
  channelSubscription: Subscription | null;
  messageListeners: Set<MessageListener>;
  readyListeners: Set<() => void>;
  closed: boolean;
};

/**
 * Creates a connection that implements the handshake protocol.
 * 
 * Protocol:
 * 1. Leader sends INIT
 * 2. Follower responds with ACK
 * 3. Leader sends COMPLETE
 * 4. Both sides are now ready
 * 
 * This layer ONLY handles the handshake protocol and message routing.
 * It does NOT buffer messages - that's the responsibility of BufferedConnection.
 * 
 * Messages sent before ready will be silently dropped (use BufferedConnection to queue them).
 */
type HandshakeConnection = Connection & {
  signalReady: () => void;
};

export const createHandshakeConnection = (
  channel: Channel,
  config: HandshakeConnectionConfig
): HandshakeConnection => {
  const { pluginId, isLeader, autoStart = true } = config;

  const state: HandshakeConnectionState = {
    handshakeState: HandshakeState.NOT_STARTED,
    channelSubscription: null,
    messageListeners: new Set(),
    readyListeners: new Set(),
    closed: false,
  };

  const sendHandshakeMessage = (type: typeof HANDSHAKE_INIT | typeof HANDSHAKE_ACK | typeof HANDSHAKE_COMPLETE): void => {
    channel.send({
      pluginId,
      type,
      payload: null,
    });
  };

  const notifyReady = (): void => {
    state.readyListeners.forEach((callback) => {
      // Use setTimeout to ensure callbacks don't block
      setTimeout(callback, 0);
    });
  };

  const handleHandshakeMessage = (message: { type: string; pluginId: string }): void => {
    switch (message.type) {
      case HANDSHAKE_INIT:
        if (!isLeader) {
          // Follower receives INIT
          // Always respond to INIT, even if already ready (handles leader reload)
          if (state.handshakeState === HandshakeState.READY) {
            // Leader reconnected - reset our ready state
            state.handshakeState = HandshakeState.WAITING_FOR_COMPLETE;
          } else {
            state.handshakeState = HandshakeState.WAITING_FOR_COMPLETE;
          }
          sendHandshakeMessage(HANDSHAKE_ACK);
        }
        break;

      case HANDSHAKE_ACK:
        if (isLeader) {
          if (state.handshakeState === HandshakeState.WAITING_FOR_ACK) {
            // Normal flow: we sent INIT, received ACK, send COMPLETE
            sendHandshakeMessage(HANDSHAKE_COMPLETE);
            state.handshakeState = HandshakeState.READY;
            notifyReady();
          } else if (state.handshakeState === HandshakeState.READY) {
            // Follower reconnected - just send COMPLETE again
            sendHandshakeMessage(HANDSHAKE_COMPLETE);
          }
        }
        break;

      case HANDSHAKE_COMPLETE:
        if (!isLeader) {
          if (state.handshakeState === HandshakeState.WAITING_FOR_COMPLETE) {
            state.handshakeState = HandshakeState.READY;
            notifyReady();
          }
        }
        break;
    }
  };

  const handleIncomingMessage = (rawMessage: unknown): void => {
    if (state.closed) return;

    // Parse and validate message structure
    if (typeof rawMessage !== 'object' || rawMessage === null) {
      return;
    }

    const msg = rawMessage as Record<string, unknown>;
    if (msg.pluginId !== pluginId) {
      return; // Not for us
    }

    if (isHandshakeMessage(rawMessage)) {
      handleHandshakeMessage(rawMessage);
    } else if (isWireMessage(rawMessage)) {
      // Forward user messages to listeners
      // Note: We forward even if not ready - it's up to the caller to handle this
      state.messageListeners.forEach((listener) => {
        try {
          listener(rawMessage);
        } catch (error) {
          console.error('[HandshakeConnection] Listener error:', error);
        }
      });
    }
  };

  // Public API

  const send = (message: unknown): void => {
    if (state.closed) {
      console.warn('[HandshakeConnection] Attempted to send on closed connection');
      return;
    }

    // Note: We allow sending even if not ready.
    // BufferedConnection will queue messages; raw usage drops them.
    channel.send({
      pluginId,
      ...(message as object),
    });
  };

  const onMessage = (listener: MessageListener): Subscription => {
    state.messageListeners.add(listener);

    return {
      remove: () => {
        state.messageListeners.delete(listener);
      },
    };
  };

  const isReady = (): boolean => {
    return state.handshakeState === HandshakeState.READY;
  };

  const onReady = (callback: () => void): Subscription => {
    if (state.handshakeState === HandshakeState.READY) {
      // Already ready, call on next tick
      setTimeout(callback, 0);
    }
    
    state.readyListeners.add(callback);

    return {
      remove: () => {
        state.readyListeners.delete(callback);
      },
    };
  };

  const close = (): void => {
    state.closed = true;
    state.channelSubscription?.remove();
    state.messageListeners.clear();
    state.readyListeners.clear();
    state.handshakeState = HandshakeState.NOT_STARTED;
  };

  /**
   * Start the handshake process.
   * Leader sends INIT; follower just waits for INIT.
   */
  const startHandshake = (): void => {
    if (state.closed) return;
    
    if (state.handshakeState !== HandshakeState.NOT_STARTED && 
        state.handshakeState !== HandshakeState.READY) {
      // Already in progress
      return;
    }

    if (isLeader) {
      state.handshakeState = HandshakeState.WAITING_FOR_ACK;
      sendHandshakeMessage(HANDSHAKE_INIT);
    }
    // Follower doesn't do anything - just waits for INIT
  };

  // Initialize: subscribe to channel
  state.channelSubscription = channel.onMessage(handleIncomingMessage);
  
  // Auto-start handshake on next tick if configured
  if (autoStart) {
    setTimeout(() => {
      if (!state.closed) {
        startHandshake();
      }
    }, 0);
  }

  return {
    send,
    onMessage,
    isReady,
    onReady,
    close,
    signalReady: startHandshake,
  };
};

