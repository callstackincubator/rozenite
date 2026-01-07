import { Channel } from '../../channel/types.js';
import { Subscription } from '../../types.js';

type MessageListener = (message: unknown) => void;

type MockChannelState = {
  listeners: Set<MessageListener>;
  peerReceive: ((message: unknown) => void) | null;
};

/**
 * Mock channel implementation for testing
 * Can be connected to another MockChannel to simulate bidirectional communication
 */
export type MockChannel = Channel & {
  connect: (otherChannel: MockChannel) => void;
  hasListeners: () => boolean;
  getListenerCount: () => number;
  // Internal method for channel communication
  receive: (message: unknown) => void;
  // Internal state access for connection
  state: MockChannelState;
};

/**
 * Create a mock channel for testing
 * Can be connected to another MockChannel to simulate bidirectional communication
 */
export const createMockChannel = (): MockChannel => {
  const state: MockChannelState = {
    listeners: new Set<MessageListener>(),
    peerReceive: null,
  };

  const connect = (otherChannel: MockChannel): void => {
    // For manual connection setup (not used by createMockChannelPair)
    state.peerReceive = otherChannel.receive;
    otherChannel.state.peerReceive = receive;
  };

  const send = (message: unknown): void => {
    if (state.peerReceive) {
      // Simulate async message delivery
      const peerReceive = state.peerReceive;
      setTimeout(() => {
        peerReceive(message);
      }, 0);
    }
  };

  // Private receive function accessed through closure in send()
  const receive = (message: unknown): void => {
    state.listeners.forEach((listener) => {
      listener(message);
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
    state.listeners.clear();
    state.peerReceive = null;
  };

  const hasListeners = (): boolean => {
    return state.listeners.size > 0;
  };

  const getListenerCount = (): number => {
    return state.listeners.size;
  };

  return {
    send,
    onMessage,
    close,
    connect,
    hasListeners,
    getListenerCount,
    receive,
    state,
  };
};

/**
 * Create a pair of connected mock channels for testing bidirectional communication
 * @returns [deviceChannel, panelChannel]
 */
export const createMockChannelPair = (): [MockChannel, MockChannel] => {
  const deviceChannel = createMockChannel();
  const panelChannel = createMockChannel();

  // Set up bidirectional communication
  deviceChannel.state.peerReceive = panelChannel.receive;
  panelChannel.state.peerReceive = deviceChannel.receive;

  return [deviceChannel, panelChannel];
};
