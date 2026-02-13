// Client API
export {
  useRozeniteDevToolsClient,
  useRozeniteDevToolsClientInternal,
} from './useRozeniteDevToolsClient.js';
export type {
  UseRozeniteDevToolsClientOptions,
  UseRozeniteDevToolsClientInternalOptions,
} from './useRozeniteDevToolsClient.js';

export { createClient } from './client/index.js';
export type {
  RozeniteDevToolsClient,
  RozeniteClientConfig,
} from './client/types.js';

// Message types
export type {
  UserMessage,
  TypedBufferConfig,
} from './connection/types.js';

// Connection API (for advanced usage)
export {
  createHandshakeConnection,
  createBufferedConnection,
} from './connection/index.js';
export type {
  Connection,
  HandshakeConnectionConfig,
  BufferedConnectionConfig,
} from './connection/types.js';

// Typed buffer (for advanced usage)
export { createTypedMessageBuffer } from './client/index.js';
export type { TypedMessageBuffer } from './client/index.js';
