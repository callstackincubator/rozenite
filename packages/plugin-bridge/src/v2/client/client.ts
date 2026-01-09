import { Channel } from '../../channel/types.js';
import { Subscription } from '../../types.js';
import {
  createHandshakeConnection,
  createBufferedConnection,
  Connection,
  WireMessage,
  UserMessage,
  TypedBufferConfig,
} from '../connection/index.js';
import { createTypedMessageBuffer, TypedMessageBuffer } from './typed-message-buffer.js';
import { RozeniteDevToolsClient } from './types.js';

type ClientState = {
  connection: Connection;
  messageBuffer: TypedMessageBuffer;
  connectionSubscription: Subscription | null;
  closed: boolean;
};

type CreateClientOptions = {
  channel: Channel;
  pluginId: string;
  isLeader: boolean;
  bufferConfig?: TypedBufferConfig;
};

/**
 * Internal client implementation.
 * Composes:
 * - HandshakeConnection (protocol)
 * - BufferedConnection (outgoing queue during handshake)
 * - TypedMessageBuffer (incoming per-type buffering with replay)
 */
export const createClientInternal = <
  TEventMap extends Record<string, unknown> = Record<string, unknown>
>(
  options: CreateClientOptions
): RozeniteDevToolsClient<TEventMap> => {
  const { channel, pluginId, isLeader, bufferConfig } = options;

  // Layer 1: Handshake connection (handles protocol)
  const handshakeConnection = createHandshakeConnection(channel, {
    pluginId,
    isLeader,
    autoStart: true,
  });

  // Layer 2: Buffered connection for outgoing messages during handshake
  const bufferedConnection = createBufferedConnection(handshakeConnection, {
    maxQueueSize: bufferConfig?.maxTotal ?? 1000,
    overflowStrategy: 'drop-oldest',
  });

  // Layer 3: Typed message buffer for incoming messages
  const messageBuffer = createTypedMessageBuffer(bufferConfig);

  const state: ClientState = {
    connection: bufferedConnection,
    messageBuffer,
    connectionSubscription: null,
    closed: false,
  };

  // Route incoming wire messages to typed buffer
  const handleIncomingMessage = (wireMessage: unknown): void => {
    if (state.closed) return;

    const wire = wireMessage as WireMessage;
    
    // Convert wire message to user message
    const userMessage: UserMessage = {
      type: wire.type,
      data: wire.data,
      timestamp: wire.timestamp,
    };

    // Let the typed buffer handle routing/buffering
    state.messageBuffer.handleMessage(userMessage);
  };

  // Subscribe to connection messages
  state.connectionSubscription = state.connection.onMessage(handleIncomingMessage);

  // Public API

  const send = <TType extends keyof TEventMap>(
    type: TType,
    data: TEventMap[TType]
  ): void => {
    if (state.closed) {
      console.warn('[Client] Attempted to send on closed client');
      return;
    }

    // Send as wire message with timestamp
    state.connection.send({
      type: type as string,
      data,
      timestamp: Date.now(),
    });
  };

  const onMessage = <TType extends keyof TEventMap>(
    type: TType,
    handler: (message: UserMessage<TEventMap[TType]>) => void
  ): Subscription => {
    return state.messageBuffer.onMessage(type as string, handler);
  };

  const onReady = (callback: () => void): Subscription => {
    return state.connection.onReady(callback);
  };

  const isReady = (): boolean => {
    return state.connection.isReady();
  };

  const close = (): void => {
    state.closed = true;
    state.connectionSubscription?.remove();
    state.messageBuffer.close();
    state.connection.close();
  };

  return {
    send,
    onMessage,
    onReady,
    isReady,
    close,
  };
};
