import { Subscription } from '../../types.js';
import { Channel } from '../../channel/types.js';

/**
 * Connection extends Channel with ready-state semantics.
 * A connection knows when it's ready to reliably send/receive messages.
 */
export type Connection = Channel & {
  /**
   * Returns true if the connection is ready for communication.
   */
  isReady: () => boolean;

  /**
   * Registers a callback to be called when the connection becomes ready.
   * If already ready, the callback is called on the next tick.
   * Returns a subscription that can be used to unsubscribe.
   */
  onReady: (callback: () => void) => Subscription;

  /**
   * Signal that this side is ready to start the handshake.
   * Only needed if autoStart is false.
   */
  signalReady?: () => void;
};

/**
 * Configuration for handshake connection
 */
export type HandshakeConnectionConfig = {
  /**
   * Unique identifier for the plugin using this connection.
   * Messages are filtered by pluginId.
   */
  pluginId: string;

  /**
   * Whether this side is the leader (initiates handshake).
   * Typically the DevTools panel is the leader.
   */
  isLeader: boolean;

  /**
   * Whether to start the handshake automatically.
   * If false, you must call signalReady() to start.
   * Defaults to true.
   */
  autoStart?: boolean;

  /**
   * Optional timeout for handshake in milliseconds.
   * If not provided, no timeout is applied.
   */
  handshakeTimeoutMs?: number;
};

/**
 * Configuration for buffered connection
 */
export type BufferedConnectionConfig = {
  /**
   * Maximum number of messages to queue before dropping.
   * Defaults to 1000.
   */
  maxQueueSize?: number;

  /**
   * What to do when queue is full.
   * - 'drop-oldest': Remove oldest message and add new one
   * - 'drop-newest': Ignore new message
   * - 'throw': Throw an error
   * Defaults to 'drop-oldest'.
   */
  overflowStrategy?: 'drop-oldest' | 'drop-newest' | 'throw';
};

/**
 * Handshake protocol message types
 */
export const HANDSHAKE_INIT = '__HANDSHAKE_INIT__' as const;
export const HANDSHAKE_ACK = '__HANDSHAKE_ACK__' as const;
export const HANDSHAKE_COMPLETE = '__HANDSHAKE_COMPLETE__' as const;

export type HandshakeMessageType =
  | typeof HANDSHAKE_INIT
  | typeof HANDSHAKE_ACK
  | typeof HANDSHAKE_COMPLETE;

export type HandshakeMessage = {
  type: HandshakeMessageType;
  pluginId: string;
  payload: null;
};

/**
 * Handshake state machine states
 */
export const HandshakeState = {
  NOT_STARTED: 'not_started',
  WAITING_FOR_ACK: 'waiting_for_ack',
  WAITING_FOR_COMPLETE: 'waiting_for_complete',
  READY: 'ready',
} as const;

export type HandshakeStateType = (typeof HandshakeState)[keyof typeof HandshakeState];

/**
 * Type guard for handshake messages
 */
export const isHandshakeMessage = (message: unknown): message is HandshakeMessage => {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  const msg = message as Record<string, unknown>;
  if (typeof msg.type !== 'string' || typeof msg.pluginId !== 'string') {
    return false;
  }

  return (
    msg.type === HANDSHAKE_INIT ||
    msg.type === HANDSHAKE_ACK ||
    msg.type === HANDSHAKE_COMPLETE
  );
};

/**
 * Wire format for user messages (v2).
 * This is the structure sent over the channel.
 */
export type WireMessage = {
  pluginId: string;
  type: string;
  timestamp: number;
  data: unknown;
};

/**
 * User message as delivered to handlers.
 * Contains the message type, data, and metadata.
 */
export type UserMessage<T = unknown> = {
  type: string;
  data: T;
  timestamp: number;
};

/**
 * Type guard for wire messages (v2 format)
 */
export const isWireMessage = (message: unknown): message is WireMessage => {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  const msg = message as Record<string, unknown>;
  return (
    typeof msg.pluginId === 'string' &&
    typeof msg.type === 'string' &&
    typeof msg.timestamp === 'number' &&
    'data' in msg &&
    !isHandshakeMessage(message)
  );
};

/**
 * Configuration for typed message buffer
 */
export type TypedBufferConfig = {
  /**
   * Maximum messages to buffer per type.
   * Defaults to 100.
   */
  maxPerType?: number;

  /**
   * Maximum total messages across all types.
   * Defaults to 1000.
   */
  maxTotal?: number;

  /**
   * Maximum age of buffered messages in milliseconds.
   * Messages older than this are dropped.
   * Defaults to 30000 (30 seconds).
   */
  maxAgeMs?: number;
};
