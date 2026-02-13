import { Subscription } from '../../types.js';
import { TypedBufferConfig, UserMessage } from '../connection/types.js';

type MessageHandler<T = unknown> = (message: UserMessage<T>) => void;

type TypeState = {
  handlers: Set<MessageHandler>;
  hasReceivedFirstHandler: boolean;
};

type BufferedMessage = {
  type: string;
  message: UserMessage;
  receivedAt: number;
};

type TypedMessageBufferState = {
  typeStates: Map<string, TypeState>;
  bufferedMessages: BufferedMessage[];
  config: Required<TypedBufferConfig>;
  closed: boolean;
};

const DEFAULT_CONFIG: Required<TypedBufferConfig> = {
  maxPerType: 100,
  maxTotal: 1000,
  maxAgeMs: 30_000, // 30 seconds
};

/**
 * TypedMessageBuffer buffers messages by type and replays them when
 * the first handler is registered for that type.
 * 
 * Features:
 * - Messages are buffered per-type until a handler is registered
 * - When first handler for a type is added, all buffered messages of that type are replayed
 * - Subsequent handlers for the same type only receive new messages
 * - Configurable limits: max per type, max total, max age
 * - Automatic cleanup of stale messages
 */
export type TypedMessageBuffer = {
  /**
   * Handle an incoming message.
   * If handlers exist for this type, deliver immediately.
   * Otherwise, buffer for later replay.
   */
  handleMessage: (message: UserMessage) => void;

  /**
   * Register a handler for a message type.
   * If this is the first handler for this type, replay buffered messages.
   */
  onMessage: <T = unknown>(
    type: string,
    handler: MessageHandler<T>
  ) => Subscription;

  /**
   * Get the number of buffered messages for a type.
   */
  getBufferedCount: (type: string) => number;

  /**
   * Get the total number of buffered messages.
   */
  getTotalBufferedCount: () => number;

  /**
   * Clear all buffered messages and handlers.
   */
  close: () => void;
};

/**
 * Creates a typed message buffer for per-type buffering with replay semantics.
 */
export const createTypedMessageBuffer = (
  config: TypedBufferConfig = {}
): TypedMessageBuffer => {
  const state: TypedMessageBufferState = {
    typeStates: new Map(),
    bufferedMessages: [],
    config: { ...DEFAULT_CONFIG, ...config },
    closed: false,
  };

  const getOrCreateTypeState = (type: string): TypeState => {
    let typeState = state.typeStates.get(type);
    if (!typeState) {
      typeState = {
        handlers: new Set(),
        hasReceivedFirstHandler: false,
      };
      state.typeStates.set(type, typeState);
    }
    return typeState;
  };

  const cleanupStaleMessages = (): void => {
    const now = Date.now();
    const maxAge = state.config.maxAgeMs;

    state.bufferedMessages = state.bufferedMessages.filter(
      (msg) => now - msg.receivedAt < maxAge
    );
  };

  const enforceBufferLimits = (type: string): void => {
    // Clean up stale messages first
    cleanupStaleMessages();

    // Enforce per-type limit
    const typeMessages = state.bufferedMessages.filter((m) => m.type === type);
    if (typeMessages.length > state.config.maxPerType) {
      const toRemove = typeMessages.length - state.config.maxPerType;
      let removed = 0;
      state.bufferedMessages = state.bufferedMessages.filter((m) => {
        if (m.type === type && removed < toRemove) {
          removed++;
          return false;
        }
        return true;
      });
    }

    // Enforce total limit
    if (state.bufferedMessages.length > state.config.maxTotal) {
      const toRemove = state.bufferedMessages.length - state.config.maxTotal;
      state.bufferedMessages = state.bufferedMessages.slice(toRemove);
    }
  };

  const bufferMessage = (message: UserMessage): void => {
    state.bufferedMessages.push({
      type: message.type,
      message,
      receivedAt: Date.now(),
    });

    enforceBufferLimits(message.type);
  };

  const deliverToHandlers = (typeState: TypeState, message: UserMessage): void => {
    typeState.handlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error(`[TypedMessageBuffer] Handler error for type "${message.type}":`, error);
      }
    });
  };

  const replayBufferedMessages = (type: string, typeState: TypeState): void => {
    // Clean up stale messages before replay
    cleanupStaleMessages();

    // Get messages for this type in order
    const messagesToReplay = state.bufferedMessages
      .filter((m) => m.type === type)
      .map((m) => m.message);

    // Remove replayed messages from buffer
    state.bufferedMessages = state.bufferedMessages.filter((m) => m.type !== type);

    // Deliver to handlers
    messagesToReplay.forEach((message) => {
      deliverToHandlers(typeState, message);
    });
  };

  // Public API

  const handleMessage = (message: UserMessage): void => {
    if (state.closed) return;

    const typeState = state.typeStates.get(message.type);

    if (typeState && typeState.handlers.size > 0) {
      // Handlers exist - deliver immediately
      deliverToHandlers(typeState, message);
    } else {
      // No handlers - buffer for later
      bufferMessage(message);
    }
  };

  const onMessage = <T = unknown>(
    type: string,
    handler: MessageHandler<T>
  ): Subscription => {
    if (state.closed) {
      return { remove: () => {} };
    }

    const typeState = getOrCreateTypeState(type);
    const isFirstHandler = !typeState.hasReceivedFirstHandler;

    typeState.handlers.add(handler as MessageHandler);

    // If this is the first handler for this type, replay buffered messages
    if (isFirstHandler) {
      typeState.hasReceivedFirstHandler = true;
      // Replay on next tick to allow caller to complete setup
      setTimeout(() => {
        if (!state.closed) {
          replayBufferedMessages(type, typeState);
        }
      }, 0);
    }

    return {
      remove: () => {
        typeState.handlers.delete(handler as MessageHandler);
      },
    };
  };

  const getBufferedCount = (type: string): number => {
    cleanupStaleMessages();
    return state.bufferedMessages.filter((m) => m.type === type).length;
  };

  const getTotalBufferedCount = (): number => {
    cleanupStaleMessages();
    return state.bufferedMessages.length;
  };

  const close = (): void => {
    state.closed = true;
    state.typeStates.clear();
    state.bufferedMessages = [];
  };

  return {
    handleMessage,
    onMessage,
    getBufferedCount,
    getTotalBufferedCount,
    close,
  };
};

