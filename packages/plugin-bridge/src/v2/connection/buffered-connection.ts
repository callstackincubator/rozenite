import { Subscription } from '../../types.js';
import { Connection, BufferedConnectionConfig } from './types.js';

type MessageListener = (message: unknown) => void;

type BufferedConnectionState = {
  outgoingQueue: unknown[];
  incomingQueue: unknown[];
  messageListeners: Set<MessageListener>;
  connectionSubscription: Subscription | null;
  readySubscription: Subscription | null;
  closed: boolean;
};

const DEFAULT_MAX_QUEUE_SIZE = 1000;
const DEFAULT_OVERFLOW_STRATEGY = 'drop-oldest';

/**
 * Creates a buffered connection that queues messages until the underlying connection is ready.
 * 
 * This is a generic facade/decorator that works with ANY Connection.
 * It doesn't know about handshakes - it just uses the connection's isReady() state.
 * 
 * Features:
 * - Queues outgoing messages until connection is ready
 * - Queues incoming messages until connection is ready
 * - Flushes queues when connection becomes ready
 * - Configurable queue size limits and overflow strategies
 * - Handles reconnection (queues again if connection becomes not-ready)
 */
export const createBufferedConnection = (
  connection: Connection,
  config: BufferedConnectionConfig = {}
): Connection => {
  const maxQueueSize = config.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;
  const overflowStrategy = config.overflowStrategy ?? DEFAULT_OVERFLOW_STRATEGY;

  const state: BufferedConnectionState = {
    outgoingQueue: [],
    incomingQueue: [],
    messageListeners: new Set(),
    connectionSubscription: null,
    readySubscription: null,
    closed: false,
  };

  const handleQueueOverflow = <T>(queue: T[], item: T, queueName: string): void => {
    if (queue.length >= maxQueueSize) {
      switch (overflowStrategy) {
        case 'drop-oldest':
          queue.shift();
          break;
        case 'drop-newest':
          return; // Don't add the new item
        case 'throw':
          throw new Error(`[BufferedConnection] ${queueName} queue overflow (max: ${maxQueueSize})`);
      }
    }
    queue.push(item);
  };

  const notifyListeners = (message: unknown): void => {
    state.messageListeners.forEach((listener) => {
      try {
        listener(message);
      } catch (error) {
        console.error('[BufferedConnection] Listener error:', error);
      }
    });
  };

  const flushQueues = (): void => {
    // Flush outgoing queue
    while (state.outgoingQueue.length > 0) {
      const message = state.outgoingQueue.shift()!;
      connection.send(message);
    }

    // Flush incoming queue
    while (state.incomingQueue.length > 0) {
      const message = state.incomingQueue.shift()!;
      notifyListeners(message);
    }
  };

  const handleIncomingMessage = (message: unknown): void => {
    if (state.closed) return;

    if (connection.isReady()) {
      // Connection ready - deliver immediately
      notifyListeners(message);
    } else {
      // Queue until ready
      handleQueueOverflow(state.incomingQueue, message, 'incoming');
    }
  };

  // Public API

  const send = (message: unknown): void => {
    if (state.closed) {
      console.warn('[BufferedConnection] Attempted to send on closed connection');
      return;
    }

    if (connection.isReady()) {
      // Connection ready - send immediately
      connection.send(message);
    } else {
      // Queue until ready
      handleQueueOverflow(state.outgoingQueue, message, 'outgoing');
    }
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
    return connection.isReady();
  };

  const onReady = (callback: () => void): Subscription => {
    return connection.onReady(callback);
  };

  const close = (): void => {
    state.closed = true;
    state.connectionSubscription?.remove();
    state.readySubscription?.remove();
    state.messageListeners.clear();
    state.outgoingQueue = [];
    state.incomingQueue = [];
    connection.close();
  };

  // Initialize: subscribe to underlying connection
  state.connectionSubscription = connection.onMessage(handleIncomingMessage);

  // Subscribe to ready events to flush queues
  state.readySubscription = connection.onReady(() => {
    if (!state.closed) {
      flushQueues();
    }
  });

  // If already ready, flush immediately
  if (connection.isReady()) {
    flushQueues();
  }

  return {
    send,
    onMessage,
    isReady,
    onReady,
    close,
  };
};

