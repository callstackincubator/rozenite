import { Channel } from '../../channel/types.js';
import { Subscription } from '../../types.js';

type MessageListener = (message: unknown) => void;

type MockChannelState = {
  listeners: Set<MessageListener>;
  peerReceive: ((message: unknown) => void) | null;
  messageLog: unknown[];
  closed: boolean;
};

/**
 * Mock channel implementation for testing.
 * Can be connected to another MockChannel to simulate bidirectional communication.
 */
export type MockChannel = Channel & {
  /**
   * Connect this channel to another channel for bidirectional communication.
   */
  connect: (otherChannel: MockChannel) => void;

  /**
   * Check if there are any listeners registered.
   */
  hasListeners: () => boolean;

  /**
   * Get the number of registered listeners.
   */
  getListenerCount: () => number;

  /**
   * Get all messages that have been sent through this channel.
   */
  getMessageLog: () => unknown[];

  /**
   * Clear the message log.
   */
  clearMessageLog: () => void;

  /**
   * Internal method for receiving messages from peer.
   */
  receive: (message: unknown) => void;

  /**
   * Internal state access for connection.
   */
  state: MockChannelState;
};

/**
 * Create a mock channel for testing.
 * Messages are delivered asynchronously (via setTimeout) to simulate real conditions.
 */
export const createMockChannel = (): MockChannel => {
  const state: MockChannelState = {
    listeners: new Set<MessageListener>(),
    peerReceive: null,
    messageLog: [],
    closed: false,
  };

  const connect = (otherChannel: MockChannel): void => {
    state.peerReceive = otherChannel.receive;
    otherChannel.state.peerReceive = receive;
  };

  const send = (message: unknown): void => {
    if (state.closed) {
      console.warn('[MockChannel] Attempted to send on closed channel');
      return;
    }

    state.messageLog.push(message);

    if (state.peerReceive) {
      const peerReceive = state.peerReceive;
      // Simulate async message delivery
      setTimeout(() => {
        peerReceive(message);
      }, 0);
    }
  };

  const receive = (message: unknown): void => {
    if (state.closed) return;

    state.listeners.forEach((listener) => {
      try {
        listener(message);
      } catch (error) {
        console.error('[MockChannel] Listener error:', error);
      }
    });
  };

  const onMessage = (listener: MessageListener): Subscription => {
    state.listeners.add(listener);

    return {
      remove: () => {
        state.listeners.delete(listener);
      },
    };
  };

  const close = (): void => {
    state.closed = true;
    state.listeners.clear();
    state.peerReceive = null;
  };

  const hasListeners = (): boolean => {
    return state.listeners.size > 0;
  };

  const getListenerCount = (): number => {
    return state.listeners.size;
  };

  const getMessageLog = (): unknown[] => {
    return [...state.messageLog];
  };

  const clearMessageLog = (): void => {
    state.messageLog = [];
  };

  return {
    send,
    onMessage,
    close,
    connect,
    hasListeners,
    getListenerCount,
    getMessageLog,
    clearMessageLog,
    receive,
    state,
  };
};

/**
 * Create a pair of connected mock channels for testing bidirectional communication.
 * 
 * @returns [channelA, channelB] - Two connected channels
 */
export const createMockChannelPair = (): [MockChannel, MockChannel] => {
  const channelA = createMockChannel();
  const channelB = createMockChannel();

  // Set up bidirectional communication
  channelA.state.peerReceive = channelB.receive;
  channelB.state.peerReceive = channelA.receive;

  return [channelA, channelB];
};

/**
 * Wait for a specified number of milliseconds.
 * Useful for waiting for async message delivery in tests.
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Wait for a condition to become true.
 * 
 * @param condition - Function that returns true when condition is met
 * @param timeout - Maximum time to wait in milliseconds (default: 1000)
 * @param interval - Check interval in milliseconds (default: 10)
 */
export const waitFor = async (
  condition: () => boolean,
  timeout = 1000,
  interval = 10
): Promise<void> => {
  const start = Date.now();
  
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error(`waitFor timeout after ${timeout}ms`);
    }
    await wait(interval);
  }
};

/**
 * Wait for both clients to be ready.
 */
export const waitForBothReady = async (
  clientA: { isReady: () => boolean; onReady: (cb: () => void) => { remove: () => void } },
  clientB: { isReady: () => boolean; onReady: (cb: () => void) => { remove: () => void } }
): Promise<void> => {
  await Promise.all([
    new Promise<void>((resolve) => {
      if (clientA.isReady()) {
        resolve();
      } else {
        const sub = clientA.onReady(() => {
          sub.remove();
          resolve();
        });
      }
    }),
    new Promise<void>((resolve) => {
      if (clientB.isReady()) {
        resolve();
      } else {
        const sub = clientB.onReady(() => {
          sub.remove();
          resolve();
        });
      }
    }),
  ]);
};
