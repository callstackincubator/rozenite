import { Subscription } from '../../types.js';
import { Channel } from '../../channel/types.js';
import { TypedBufferConfig, UserMessage } from '../connection/types.js';

/**
 * Rozenite DevTools client.
 * 
 * Provides typed bidirectional communication between device and DevTools panel.
 * Messages are automatically buffered per-type and replayed when handlers are registered.
 */
export type RozeniteDevToolsClient<
  TEventMap extends Record<string, unknown> = Record<string, unknown>
> = {
  /**
   * Send a typed message to the other side.
   * Messages are timestamped automatically.
   */
  send: <TType extends keyof TEventMap>(
    type: TType,
    data: TEventMap[TType]
  ) => void;

  /**
   * Register a handler for a specific message type.
   * 
   * When the first handler for a type is registered, any buffered messages
   * of that type are replayed to the handler.
   * 
   * Subsequent handlers for the same type only receive new messages.
   */
  onMessage: <TType extends keyof TEventMap>(
    type: TType,
    handler: (message: UserMessage<TEventMap[TType]>) => void
  ) => Subscription;

  /**
   * Register a callback to be called when the connection is ready.
   * If already ready, the callback is called on the next tick.
   */
  onReady: (callback: () => void) => Subscription;

  /**
   * Check if the connection is ready for communication.
   * Messages can be sent before ready - they will be queued.
   */
  isReady: () => boolean;

  /**
   * Close the client and release all resources.
   */
  close: () => void;
};

/**
 * Configuration for creating a client.
 */
export type RozeniteClientConfig = {
  /**
   * Unique identifier for the plugin.
   */
  pluginId: string;

  /**
   * Optional: provide a custom channel for testing.
   */
  channel?: Channel;

  /**
   * Optional: specify leader/follower role.
   * If not provided, detected from environment.
   */
  isLeader?: boolean;

  /**
   * Optional: configuration for message buffering.
   */
  buffer?: TypedBufferConfig;
};
